#!/usr/bin/env python3
"""Recover Coherence / Cohesion anchors lost to a text-stream mismatch.

WHY THE FIXTURE SETS WERE TINY
------------------------------
extract-examiner-comments-fitz.py builds two different texts from the same page
and they are not the same text:

  * the essay body comes from `student_original()`, which walks the glyphs and
    keeps only what the student wrote -- black text plus struck-through
    deletions -- and drops the examiner's underlined insertions.
  * the anchor comes from `page_anchors()`, which calls `page.get_textbox()` on
    the pastel highlight rectangle. That returns the *flattened* page: the
    student's words and the examiner's insertions interleaved.

So an anchor arrives as

    "perspective, it is impossibleIt is not realistic to push force/require"

while the essay says

    "perspective, it is impossible to push force ..."

The two streams agree everywhere the examiner left the text alone and diverge
exactly where the examiner edited -- which is exactly where the examiner also
left a comment. Coherence and cohesion comments cluster on rewritten topic
sentences and rewritten linkers, so they take the worst of it: 47 of 65
coherence anchors and 19 of 28 cohesion anchors fail to resolve.

That is not a fuzzy-threshold problem. Lowering FUZZY_THRESHOLD cannot fix a
string that contains words the haystack does not contain; it can only start
matching the wrong span.

THE FIX
-------
Read the highlight rectangle against the student-original character stream
instead of the flattened page: select the glyphs whose centre falls inside the
rectangle, keep the ones `student_original()` would have kept, and take the
substring they span. The result is a literal substring of the essay by
construction, not a fuzzy match.

Comment-to-anchor pairing is left byte-identical to the original extractor --
same rectangles, same merge, same `attach_anchors` / `attach_positional_anchors`
order. Only the text read out of each rectangle changes. This deliberately
recovers no comment that was not already anchored, so it cannot invent an anchor
that the examiner did not place.

    python3 scripts/recover-cc-anchors.py            # extract (cached) + build
    python3 scripts/recover-cc-anchors.py --refresh  # force re-extraction
"""
import argparse
import importlib.util
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
MARKED = ROOT / "marked script"
CORPUS = ROOT / "tmp" / "corpus"
AB = ROOT / "tmp" / "ab"
CACHE = CORPUS / "examiner-comments-recovered.json"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, str(ROOT / "scripts" / path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


ex = _load("_extract_fitz", "extract-examiner-comments-fitz.py")
an = _load("_analyze_examiner", "analyze-examiner-comments.py")
bf = _load("_build_fixtures", "build-examiner-fixtures.py")


# --- phase 1: re-extract with anchors read off the student-original stream ----

def student_original_chars(page, margin_x):
    """`student_original()`, but keeping each kept glyph's bbox.

    Must stay character-for-character identical to the original so the essay
    body in the corpus is unchanged and recovered anchors are substrings of it.
    """
    marks = ex.thin_marks(page)
    out = []
    for block in page.get_text("rawdict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block.get("lines", []):
            for span in line["spans"]:
                if span["bbox"][0] >= margin_x:
                    continue
                for char in span.get("chars", []):
                    if span["color"] == 0:
                        out.append((char["c"], char["bbox"]))
                        continue
                    fraction = ex.struck_fraction(char["bbox"], marks)
                    if fraction is not None and fraction < ex.STRIKE_MAX_FRACTION:
                        out.append((char["c"], char["bbox"]))
    return out


def student_original_lines(chars, tol=2.8):
    """Visual lines of the student-original stream, as `attach_positional_anchors` wants.

    The positional fallback anchors a balloon to the body line beside it. The
    original extractor took that line from the flattened layout text, so a
    positional anchor carried the examiner's insertions too and hit the same
    mismatch as a highlight anchor -- every unresolved coherence/cohesion anchor
    left after the highlight fix was a positional one. Slicing the line out of
    the student-original stream by glyph index makes it a substring by
    construction.
    """
    buckets = []
    for i, (_, b) in enumerate(chars):
        for bucket in buckets:
            if abs(bucket["top"] - b[1]) <= tol:
                bucket["idx"].append(i)
                bucket["top"] = min(bucket["top"], b[1])
                break
        else:
            buckets.append({"top": b[1], "idx": [i]})
    stream = "".join(c for c, _ in chars)
    out = []
    for bucket in buckets:
        lo, hi = min(bucket["idx"]), max(bucket["idx"])
        text = ex.clean(stream[lo:hi + 1])
        if text:
            out.append({"top": bucket["top"], "text": text})
    return sorted(out, key=lambda l: l["top"])


def anchor_rects(page, margin_x):
    """Same rectangles, same merge order, as page_anchors()."""
    rects = []
    for d in page.get_drawings():
        if d["type"] not in ("f", "fs"):
            continue
        if not ex.is_anchor_fill(d.get("fill")):
            continue
        r = d["rect"]
        if r.x1 > margin_x or r.height > 30 or r.width < 2:
            continue
        rects.append(r)
    return ex.merge_rects(rects)


def rect_student_text(rect, chars):
    """The student's own words under a highlight rectangle.

    Glyphs are selected by centre-point containment, then the span from the
    first to the last selected glyph is returned. Examiner insertions sitting
    between two selected glyphs are already absent from `chars`, so the span is
    the student's original text for that range and nothing else.
    """
    hit = [
        i for i, (_, b) in enumerate(chars)
        if rect.x0 - 1 <= (b[0] + b[2]) / 2 <= rect.x1 + 1
        and rect.y0 - 1 <= (b[1] + b[3]) / 2 <= rect.y1 + 1
    ]
    if not hit:
        return ""
    return ex.clean("".join(c for c, _ in chars[hit[0]:hit[-1] + 1]))[:300]


def process(pdf: Path):
    """ex.process() with one substitution: how anchor text is read."""
    doc = fitz.open(str(pdf))
    all_text = "".join(p.get_text() for p in doc)
    if len(all_text.strip()) < 200:
        doc.close()
        return None  # OCR-only script: no colour info, nothing to recover

    comments, body_all_lines = [], []
    for page in doc:
        margin_x = page.rect.width * ex.MARGIN_FRAC
        marg, body = ex.split_margin_body(page, margin_x)
        mlines, blines = ex.group_lines(marg), ex.group_lines(body)

        chars = student_original_chars(page, margin_x)
        reconstructed = "".join(c for c, _ in chars)
        if len(reconstructed.split()) >= 20:
            body_all_lines.append(reconstructed)
        else:
            body_all_lines.extend(l["text"] for l in blines)

        page_comments = ex.parse_margin_comments(mlines)
        if not page_comments:
            continue
        anchors = []
        for rect in anchor_rects(page, margin_x):
            txt = rect_student_text(rect, chars)
            if txt:
                anchors.append({"top": rect.y0, "x0": rect.x0, "text": txt})
        ex.attach_anchors(page_comments, anchors)
        pos_lines = student_original_lines(chars) or blines
        ex.attach_positional_anchors(page_comments, pos_lines, page.rect.height)
        for c in page_comments:
            comments.append({
                "text": c["text"],
                "kind": "margin",
                "anchoredText": c.get("anchoredText", ""),
                "positional": c.get("positional", False),
                "wordArtifact": c["word_artifact"],
                "extractor": "word_margin",
                "_cid": c.get("cid"),
            })
    doc.close()

    body_text = "\n".join(body_all_lines)
    gdocs = ex.extract_gdoc_comments(body_all_lines)
    if len(gdocs) >= 2:
        for g in gdocs:
            comments.append({"text": g["text"], "kind": "margin", "anchoredText": "",
                             "positional": False, "wordArtifact": False,
                             "extractor": "gdoc", "_cid": g.get("cid")})
    else:
        for it in ex.extract_inline_brackets(body_text):
            comments.append({"text": it["text"], "kind": "inline",
                             "anchoredText": it["anchoredText"], "positional": False,
                             "wordArtifact": False, "extractor": "inline", "_cid": None})

    summ = ex.extract_summary(body_all_lines)
    for s in summ:
        comments.append({"text": s, "kind": "summary", "anchoredText": "", "positional": False,
                         "wordArtifact": False, "extractor": "summary", "_cid": None})

    seen, uniq = set(), []
    for c in comments:
        k = (c["kind"], c.pop("_cid"), c["text"].lower())
        if k in seen:
            continue
        seen.add(k)
        uniq.append(c)

    return {
        "sourcePdf": pdf.name,
        "essay": body_text,
        "bandFromFilename": ex.band_from_filename(pdf.name),
        "bandFromSummary": ex.band_from_summary(summ),
        "comments": uniq,
    }


def extract_all():
    baseline = {r["sourcePdf"]: r for r in json.loads((CORPUS / "examiner-comments.json").read_text())}
    records = []
    pdfs = sorted(MARKED.glob("*.pdf"))
    for i, p in enumerate(pdfs, 1):
        try:
            rec = process(p)
        except Exception as e:                                  # noqa: BLE001
            print(f"[{i}/{len(pdfs)}] {p.name[:58]:60} FAILED {e}", flush=True)
            rec = None
        if rec is None:
            # OCR-only or unreadable: keep the original record untouched.
            rec = baseline.get(p.name)
            if rec is None:
                continue
        records.append(rec)
        print(f"[{i}/{len(pdfs)}] {p.name[:58]:60} {len(rec['comments']):4d}", flush=True)
    CACHE.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    return records


# --- phase 2: classify + build fixtures, using the existing logic verbatim ----

CRITERIA = {"coherence": ("cohereAnchors", AB / "cohere-recovered-fixtures.json"),
            "cohesion": ("cohAnchors", AB / "coh-recovered-fixtures.json")}

# The cohesion lexicon in analyze-examiner-comments.py is
#     \b(linker|linking (word|phrase)|connector|transition|signpost)\b
# The trailing \b sits right after the singular, so every plural fails to match:
# "linking phrases", "linking words", "connectors", "transitions" all score zero
# and the comment falls through to another criterion. Same defect exists in the
# coherence lexicon ("paragraphs", "topic sentences"), but every comment it
# would flip turned out on inspection to be a Task Response point about
# development or essay length, so only the cohesion half is repaired here.
#
# Deliberately NOT repaired: the examiners' "CC" abbreviation. It is unmatched
# by any lexicon, but it names the whole Coherence-and-Cohesion band, and in
# this corpus it appears almost only in criterion-list praise ("all band 7+ to
# start TA CC V G"). Treating it as a cohesion cue would add anchors pointing at
# nothing cohesion-specific.
LINKER_PLURAL = re.compile(
    r"\b(linking (words|phrases)|linkers|connectors|transitions|signposts|cohesive devices)\b", re.I)


def classify(text, kind):
    crit, reason = an.classify(text, kind)
    if crit != "cohesion" and kind != "summary" and LINKER_PLURAL.search(text):
        return "cohesion", "linker_plural"
    return crit, reason


def build(records, criterion, key, out_path):
    by_pdf = {r["sourcePdf"]: r for r in records}
    wanted = []
    for r in records:
        for c in r["comments"]:
            if c.get("wordArtifact"):
                continue
            crit, _ = classify(c["text"], c["kind"])
            if crit != criterion or c["kind"] == "summary":
                continue
            if not (c.get("anchoredText") or "").strip():
                continue
            wanted.append({"pdf": r["sourcePdf"], "text": c["text"], "anchor": c["anchoredText"]})

    fixtures, kinds = [], Counter()
    for pdf in sorted({c["pdf"] for c in wanted}):
        record = by_pdf[pdf]
        cleaned = bf.clean_essay(record.get("essay", "") or "")
        question, essay = bf.split_prompt(cleaned)
        words = len(essay.split())
        if not bf.MIN_WORDS <= words <= bf.MAX_WORDS:
            continue
        haystack = re.sub(r"\s+", " ", essay)
        anchors, seen = [], set()
        for comment in (c for c in wanted if c["pdf"] == pdf):
            anchor = re.sub(r"\s+", " ", comment["anchor"]).strip()
            if len(anchor.split()) < bf.MIN_ANCHOR_WORDS:
                continue
            resolved, kind = bf.resolve_anchor(anchor, haystack)
            if resolved is None:
                continue
            # One examiner note can surface twice -- two balloons carrying the
            # same wording over the same sentence, or the same page extracted
            # twice. Two anchors for one finding would let a single recovered
            # comment move recall twice, so collapse same-text overlapping spans.
            at = haystack.find(resolved)
            span = (at, at + len(resolved))
            if any(prev_text == comment["text"] and prev[0] < span[1] and span[0] < prev[1]
                   for prev, prev_text in seen):
                continue
            seen.add((span, comment["text"]))
            kinds[kind] += 1
            anchors.append({"anchoredText": resolved, "comment": comment["text"], "match": kind})
        if anchors:
            fixtures.append({
                "fileId": pdf,
                "docTitle": pdf,
                "sourcePdf": pdf,
                "band": record.get("bandFromFilename") or record.get("bandFromSummary"),
                "question": question,
                "essay": essay,
                "essayWords": words,
                key: anchors,
            })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixtures, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(f[key]) for f in fixtures)
    bad = [(f["sourcePdf"], a["anchoredText"]) for f in fixtures for a in f[key]
           if a["anchoredText"] not in f["essay"] and a["anchoredText"] not in re.sub(r"\s+", " ", f["essay"])]
    print(f"{criterion:10} candidates {len(wanted):4d}  ->  {len(fixtures):3d} scripts / {total:3d} anchors "
          f"{dict(kinds)}")
    print(f"{'':10} literal-in-essay verified {total - len(bad)}/{total}"
          + (f"  FAILURES: {bad}" if bad else ""))
    print(f"{'':10} wrote {out_path}")
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-run the PDF pass")
    args = ap.parse_args()

    if args.refresh or not CACHE.exists():
        records = extract_all()
    else:
        records = json.loads(CACHE.read_text(encoding="utf-8"))
        print(f"using cached {CACHE} ({len(records)} scripts)")

    for criterion, (key, out) in CRITERIA.items():
        build(records, criterion, key, out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
