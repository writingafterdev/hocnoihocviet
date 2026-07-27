#!/usr/bin/env python3
"""Extract examiner comments from the marked-script PDF corpus.

Multi-strategy, because the corpus mixes at least four annotation conventions:
  A. MS Word right-margin balloons rendered as `Comment [Dave12]: ...`
  B. Google-Docs style footnote comments rendered as `[TG9] ...` at the end
  C. ieltsanswers style inline bracketed notes `[ ... ]` inside the body text
  D. end-of-script rubric/summary blocks (`Task achievement: 6 ...`, `Overall: 6.5`)

Anchored essay text is recovered from the pastel highlight rectangles that Word
draws over a comment's anchor range.
"""
import json
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
MARKED = ROOT / "marked script"
OUT = ROOT / "tmp" / "corpus"

MARGIN_FRAC = 0.68
WS = re.compile(r"\s+")

MARKER_RE = re.compile(
    r"(Comment(?:ed)?\s*\[([^\]]{1,40})\]\s*:?|Formatted\s*:|Deleted\s*:|Inserted\s*:|Moved\s*(?:up|down)?\s*:)"
)
GDOC_RE = re.compile(r"^\s*\[([A-Za-z]{1,5}\d{1,3})\]\s*(.+)$")

RUBRIC_RE = re.compile(
    r"^\s*(task\s*(?:achievement|response|resonse)|coherence\s*(?:and|/|&)?\s*cohesion|"
    r"cohesion\s*(?:and|/|&)?\s*coherence|cohesion|coherence|lexical\s*resource|vocabulary|"
    r"grammatical\s*range(?:\s*(?:and|&)\s*accuracy)?|grammar|overall(?:\s*band)?(?:\s*score)?|band)\b"
    r"\s*[:=\-]?\s*(?=\d|$|[a-z])",
    re.I,
)


def clean(s: str) -> str:
    return WS.sub(" ", s.replace("­", "")).strip()


def is_anchor_fill(fill):
    if not fill or len(fill) < 3:
        return False
    r, g, b = fill[:3]
    if r > 0.97 and g > 0.97 and b > 0.97:
        return False
    if abs(r - g) < 0.04 and abs(g - b) < 0.04:
        return False
    return min(r, g, b) > 0.45 and max(r, g, b) > 0.85


def group_lines(words, tol=2.8):
    """words: list of (x0,y0,x1,y1,text)."""
    buckets = []
    for w in sorted(words, key=lambda w: (round(w[1], 1), w[0])):
        for b in buckets:
            if abs(b["top"] - w[1]) <= tol:
                b["w"].append(w)
                b["top"] = min(b["top"], w[1])
                break
        else:
            buckets.append({"top": w[1], "w": [w]})
    out = []
    for b in buckets:
        ws = sorted(b["w"], key=lambda w: w[0])
        out.append(
            {
                "top": b["top"],
                "x0": min(w[0] for w in ws),
                "x1": max(w[2] for w in ws),
                "bottom": max(w[3] for w in ws),
                "text": clean(" ".join(w[4] for w in ws)),
            }
        )
    return sorted(out, key=lambda l: (l["top"], l["x0"]))


def merge_rects(rects, xgap=6.0, ytol=3.0):
    rects = sorted(rects, key=lambda r: (round(r.y0, 0), r.x0))
    merged = []
    for r in rects:
        if merged:
            m = merged[-1]
            if abs(m.y0 - r.y0) <= ytol and r.x0 - m.x1 <= xgap:
                merged[-1] = m | r
                continue
        merged.append(fitz.Rect(r))
    return merged


def page_anchors(page, margin_x):
    rects = []
    for d in page.get_drawings():
        if d["type"] not in ("f", "fs"):
            continue
        if not is_anchor_fill(d.get("fill")):
            continue
        r = d["rect"]
        if r.x1 > margin_x or r.height > 30 or r.width < 2:
            continue
        rects.append(r)
    out = []
    for r in merge_rects(rects):
        txt = clean(page.get_textbox(fitz.Rect(r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1)))
        if txt:
            out.append({"top": r.y0, "x0": r.x0, "text": txt[:300]})
    return out



MARK_HEAD = re.compile(r"^\s*(Comment(?:ed)?\s*\[|Formatted\s*:|Deleted\s*:|Inserted\s*:)")

# Word renders tracked changes into the page: insertions underlined, deletions
# struck through, both in the reviewer's colour. Flattening that gives text the
# student never wrote -- "It is Some argued", "As for meIn my opinion" -- which
# is useless as a fixture because no quote from it resolves.
#
# Both marks are thin filled rects. What separates them is where they sit
# against the glyph: a strikethrough crosses the middle (~0.53 of glyph height),
# an underline sits below (~0.89). Classification has to be per character, not
# per span, because PyMuPDF merges a deleted run and an inserted run into one
# span when they share a colour.
STRIKE_MAX_FRACTION = 0.7


def thin_marks(page):
    return [
        d["rect"] for d in page.get_drawings()
        if d.get("rect") and d["rect"].height < 2.5 and d["rect"].width > 3
    ]


def struck_fraction(bbox, marks):
    """Where the nearest thin rect crosses this glyph, as a fraction of height."""
    x0, y0, x1, y1 = bbox
    height = (y1 - y0) or 1
    best = None
    for rect in marks:
        if rect.x0 < x1 and x0 < rect.x1:
            fraction = ((rect.y0 + rect.y1) / 2 - y0) / height
            if best is None or abs(fraction - 0.5) < abs(best - 0.5):
                best = fraction
    return best


def student_original(page, margin_x):
    """The essay as the student wrote it: unmarked text plus deleted text."""
    marks = thin_marks(page)
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
                        out.append(char["c"])
                        continue
                    fraction = struck_fraction(char["bbox"], marks)
                    # Struck through: the student wrote it, the examiner cut it.
                    # Underlined or unmarked colour: the examiner added it.
                    if fraction is not None and fraction < STRIKE_MAX_FRACTION:
                        out.append(char["c"])
    return "".join(out)


def split_margin_body(page, margin_x):
    """Word balloons are rendered in their own (smaller) font in the right band.

    Deriving the balloon font size per page keeps rubric TABLES that happen to
    extend past the x-threshold out of the margin stream.
    """
    spans = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b.get("lines", []):
            for sp in l["spans"]:
                spans.append(sp)
    sizes = {round(sp["size"], 1) for sp in spans
             if MARK_HEAD.match(sp["text"]) and sp["bbox"][0] >= margin_x * 0.92}
    marg, body = [], []
    for sp in spans:
        x0, y0, x1, y1 = sp["bbox"]
        rec = (x0, y0, x1, y1, sp["text"])
        if not sp["text"].strip():
            continue
        is_balloon = (
            sizes
            and x0 >= margin_x * 0.92
            and any(abs(round(sp["size"], 1) - z) <= 0.2 for z in sizes)
        )
        (marg if is_balloon else body).append(rec)
    return marg, body


def parse_margin_comments(lines):
    """Split the concatenated right-margin text on Word revision markers."""
    if not lines:
        return []
    joined = []
    cursor = 0
    hits = []
    for ln in lines:
        t = ln["text"]
        if not t:
            continue
        for m in MARKER_RE.finditer(t):
            hits.append(
                {
                    "start": cursor + m.start(),
                    "end": cursor + m.end(),
                    "raw": m.group(1),
                    "cid": m.group(2),
                    "top": ln["top"],
                }
            )
        joined.append(t)
        cursor += len(t) + 1
    if not hits:
        return []
    blob = "\n".join(joined)
    out = []
    for i, h in enumerate(hits):
        nxt = hits[i + 1]["start"] if i + 1 < len(hits) else len(blob)
        body = clean(blob[h["end"] : nxt])
        if h["cid"]:
            body = re.sub(rf"^{re.escape(h['cid'])}\s*[:\]]?\s*", "", body)
        body = body.lstrip(":]. ").strip()
        if not body:
            continue
        word_artifact = not h["raw"].lower().startswith("comment")
        out.append(
            {
                "text": body,
                "cid": h["cid"],
                "top": h["top"],
                "marker": h["raw"].rstrip(": ").strip(),
                "word_artifact": word_artifact,
            }
        )
    return out


def cid_order(c):
    m = re.search(r"(\d+)$", c.get("cid") or "")
    return int(m.group(1)) if m else 10**6


def attach_anchors(comments, anchors):
    """Word stacks balloons so vertical order can drift; pair by within-page order."""
    real = [c for c in comments if not c["word_artifact"]]
    if not real or not anchors:
        return
    ordered = sorted(real, key=lambda c: (cid_order(c), c["top"]))
    anch = sorted(anchors, key=lambda a: (a["top"], a["x0"]))
    if len(ordered) == len(anch):
        for c, a in zip(ordered, anch):
            c["anchoredText"] = a["text"]
        return
    # fall back to nearest-by-vertical-position, greedy, no reuse
    used = set()
    for c in sorted(real, key=lambda c: c["top"]):
        best, bd = None, 1e9
        for i, a in enumerate(anch):
            if i in used:
                continue
            d = abs(a["top"] - c["top"])
            if d < bd:
                best, bd = i, d
        if best is not None and bd < 220:
            used.add(best)
            c["anchoredText"] = anch[best]["text"]


def attach_positional_anchors(comments, body_lines, page_height):
    """Anchor the leftovers to the body line beside them.

    Word only draws a highlight when a comment covers a range; a comment pinned
    to a point gets none, which leaves about a third of real margin comments
    without an anchor and caps every fixture set built from them. A balloon sits
    roughly level with the text it refers to, so the nearest body line is a
    usable, weaker anchor.

    Marked `positional` so a consumer can require exact anchors when it needs
    them. Scored at sentence granularity these behave like recovered anchors;
    scored at span level they are noisier than highlight-derived ones.
    """
    if not body_lines:
        return
    for comment in comments:
        if comment["word_artifact"] or comment.get("anchoredText"):
            continue
        nearest, distance = None, 1e9
        for line in body_lines:
            gap = abs(line["top"] - comment["top"])
            if gap < distance:
                nearest, distance = line, gap
        # A balloon more than a tenth of a page from any line is not beside it.
        if nearest and distance < page_height * 0.10 and len(nearest["text"].split()) >= 4:
            comment["anchoredText"] = nearest["text"][:300]
            comment["positional"] = True


BRACKET_RE = re.compile(r"\[([^\[\]]{10,700})\]")
INLINE_STOP = re.compile(r"^(https?://|\d{1,3}\]?$|sic\b)", re.I)


def extract_inline_brackets(body_text):
    out = []
    for m in BRACKET_RE.finditer(body_text):
        v = clean(m.group(1))
        if not v or INLINE_STOP.search(v):
            continue
        if re.match(r"^[A-Za-z]{1,5}\d{1,3}$", v):
            continue
        if len(v.split()) < 3:
            continue
        pre = clean(body_text[max(0, m.start() - 160) : m.start()])
        out.append({"text": v, "anchoredText": pre[-160:]})
    return out


GDOC_BARE_RE = re.compile(r"^\s*\[([A-Za-z]{1,5}\d{1,3})\]\s*$")


def extract_gdoc_comments(body_lines):
    out = []
    cur = None
    for ln in body_lines:
        mb = GDOC_BARE_RE.match(ln)
        m = None if mb else GDOC_RE.match(ln)
        if mb:
            if cur:
                out.append(cur)
            cur = {"text": "", "cid": mb.group(1)}
            continue
        if m:
            if cur:
                out.append(cur)
            cur = {"text": clean(m.group(2)), "cid": m.group(1)}
        elif cur is not None:
            t = ln.strip()
            if not t:
                out.append(cur)
                cur = None
            elif len(cur["text"]) < 500:
                cur["text"] = clean(cur["text"] + " " + t)
    if cur:
        out.append(cur)
    return [c for c in out if len(c["text"].split()) >= 2]


CRIT_LABEL = re.compile(
    r"(?:^|\n)\s*(task\s*(?:achievement|response|resonse)|"
    r"coherence\s*(?:and|/|&)?\s*cohesion|cohesion\s*(?:and\s*\n?\s*)?coherence|"
    r"cohesion\s*/?\s*coherence|cohesion|coherence|lexical\s*resource|vocabulary|"
    r"grammatical\s*range(?:\s*(?:and|&)\s*accuracy)?|grammar|"
    r"overall(?:\s*band)?(?:\s*score)?)\s*[:=\-–]?\s*",
    re.I,
)


def extract_summary(body_lines):
    """End-of-script rubric rows (criterion + score + justification) and numbered advice.

    Two layouts occur: a one-line-per-criterion list (`Task achievement: 6 ...`)
    and a three-column table where the justification spills over several lines.
    """
    text = "\n".join(clean(l) for l in body_lines)
    out = []
    hits = list(CRIT_LABEL.finditer(text))
    if len(hits) >= 2:
        for i, m in enumerate(hits):
            nxt = hits[i + 1].start() if i + 1 < len(hits) else len(text)
            tail = text[m.end() : nxt]
            # a rubric row must start with a score
            # table cells sometimes wrap ("Cohesion and | 6-7 | ...  / coherence")
            sm = re.match(
                r"\s*(?:(?:and|&|/|coherence|cohesion|range|accuracy|resource|response)\s+){0,3}"
                r"(\d(?:\.\d)?(?:\s*[-/]\s*\d(?:\.\d)?)?)\b",
                tail,
                re.I,
            )
            if not sm:
                continue
            just = clean(tail[sm.end() :])[:900]
            label = clean(m.group(1))
            out.append(clean(f"{label}: {sm.group(1)} {just}"))
    n = len(body_lines)
    for i, ln in enumerate(body_lines):
        t = clean(ln)
        if not t or len(t) > 400:
            continue
        if re.match(r"^\d[\.\)]\s+\S", t) and len(t.split()) >= 4 and i > n * 0.4:
            out.append(t)
    seen, uniq = set(), []
    for t in out:
        k = t.lower()[:120]
        if k in seen or len(t.split()) < 2:
            continue
        seen.add(k)
        uniq.append(t)
    return uniq


def ocr_page(page):
    """Return an OCR'd surrogate page (keeps word geometry) or None."""
    try:
        pix = page.get_pixmap(dpi=250)
        return fitz.open("pdf", pix.pdfocr_tobytes(language="eng"))
    except Exception:
        return None


def band_from_filename(name: str):
    s = name.lower().replace("_", "-")
    m = re.search(r"(\d)[\s\-]*point[\s\-]*(\d)", s)
    if m:
        return f"{m.group(1)}.{m.group(2)}"
    for pat in (
        r"band[\s\-]*(\d(?:[.\-]\d)?)",
        r"(\d(?:[.\-]\d)?)[\s\-]*band",
        r"\b(\d[.\-]5)\b",
        r"t(?:ask)?[\s\-]*2[\s\-]*(\d(?:[.\-]\d)?)\b",
        r"\b(\d(?:[.\-]\d)?)[\s\-]*t2\b",
    ):
        m = re.search(pat, s)
        if not m:
            continue
        v = m.group(1).replace("-", ".")
        try:
            f = float(v)
        except ValueError:
            continue
        if 4.0 <= f <= 9.0:
            return v
    return None


OVERALL_RE = re.compile(r"^overall[^:]*:\s*(\d(?:\.\d)?)", re.I)


def band_from_summary(summaries):
    """Fallback: the examiner's own overall score from the end-of-script rubric."""
    for s in summaries:
        m = OVERALL_RE.match(s.strip())
        if m:
            return m.group(1)
    for s in summaries:
        m = re.search(r"\bband\s*score\s*(\d(?:\.\d)?)", s, re.I)
        if m:
            return m.group(1)
    return None


def process(pdf: Path):
    diag = {"file": pdf.name, "strategies": [], "ocr": False, "pages": 0}
    try:
        doc = fitz.open(str(pdf))
    except Exception as e:
        diag["error"] = f"open_failed: {e}"
        return [], diag, ""
    diag["pages"] = len(doc)
    all_text = "".join(p.get_text() for p in doc)
    ocr_mode = len(all_text.strip()) < 200
    diag["ocr"] = ocr_mode

    comments = []
    body_all_lines = []

    for page in doc:
        W = page.rect.width
        margin_x = W * MARGIN_FRAC
        if ocr_mode:
            od = ocr_page(page)
            if od is None:
                continue
            op = od[0]
            OW = op.rect.width
            words = [(w[0], w[1], w[2], w[3], w[4]) for w in op.get_text("words")]
            omarg = [w for w in words if w[0] >= OW * 0.66]
            obody = [w for w in words if w[0] < OW * 0.66]
            olines = group_lines(omarg, tol=4.0)
            body_all_lines.extend(l["text"] for l in group_lines(obody, tol=4.0))
            for c in parse_margin_comments(olines):
                comments.append(
                    {
                        "text": c["text"],
                        "kind": "margin",
                        "anchoredText": "",
                        "_artifact": c["word_artifact"],
                        "_src": "ocr_margin",
                        "_cid": c.get("cid"),
                    }
                )
            od.close()
            continue
        marg, body = split_margin_body(page, margin_x)
        mlines = group_lines(marg)
        blines = group_lines(body)
        # Reconstruct the student's text rather than the flattened marked-up
        # version; fall back to the layout lines when nothing is recoverable.
        reconstructed = student_original(page, margin_x)
        if len(reconstructed.split()) >= 20:
            body_all_lines.append(reconstructed)
        else:
            body_all_lines.extend(l["text"] for l in blines)

        page_comments = parse_margin_comments(mlines)
        if page_comments:
            attach_anchors(page_comments, page_anchors(page, margin_x))
            attach_positional_anchors(page_comments, blines, page.rect.height)
            for c in page_comments:
                comments.append(
                    {
                        "text": c["text"],
                        "kind": "margin",
                        "anchoredText": c.get("anchoredText", ""),
                        "positional": c.get("positional", False),
                        "_artifact": c["word_artifact"],
                        "_src": "word_margin",
                        "_cid": c.get("cid"),
                    }
                )
    doc.close()

    if any(c["_src"] == "word_margin" for c in comments):
        diag["strategies"].append("word_margin")
    if any(c["_src"] == "ocr_margin" for c in comments):
        diag["strategies"].append("ocr_margin")

    body_text = "\n".join(body_all_lines)

    gdocs = extract_gdoc_comments(body_all_lines)
    if len(gdocs) >= 2:
        diag["strategies"].append("gdoc_footnote")
        for g in gdocs:
            comments.append(
                {"text": g["text"], "kind": "margin", "anchoredText": "", "_artifact": False,
                 "_src": "gdoc", "_cid": g.get("cid")}
            )

    if not any(c["_src"] == "gdoc" for c in comments):
        inline = extract_inline_brackets(body_text)
        if inline:
            diag["strategies"].append("inline_bracket")
            for it in inline:
                comments.append(
                    {
                        "text": it["text"],
                        "kind": "inline",
                        "anchoredText": it["anchoredText"],
                        "_artifact": False,
                        "_src": "inline",
                    }
                )

    summ = extract_summary(body_all_lines)
    if summ:
        diag["strategies"].append("summary")
        for s in summ:
            comments.append(
                {"text": s, "kind": "summary", "anchoredText": "", "_artifact": False, "_src": "summary"}
            )

    # dedupe
    seen, uniq = set(), []
    for c in comments:
        k = (c["kind"], c.get("_cid"), c["text"].lower())
        if k in seen:
            continue
        seen.add(k)
        uniq.append(c)
    diag["comments"] = len(uniq)
    diag["real_comments"] = sum(1 for c in uniq if not c["_artifact"])
    diag["band_from_summary"] = band_from_summary(summ)
    # The essay body is needed to score a prompt against these comments: an
    # anchor alone says where a marker stopped, not what they were reading.
    return uniq, diag, body_text


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records, diags = [], []
    pdfs = sorted(MARKED.glob("*.pdf"))
    for i, p in enumerate(pdfs, 1):
        cs, d, body = process(p)
        diags.append(d)
        records.append(
            {
                "sourcePdf": p.name,
                "essay": body,
                "bandFromFilename": band_from_filename(p.name),
                "bandFromSummary": d.get("band_from_summary"),
                "comments": [
                    {
                        "text": c["text"],
                        "kind": c["kind"],
                        "anchoredText": c.get("anchoredText", ""),
                        "positional": c.get("positional", False),
                        "wordArtifact": c["_artifact"],
                        "extractor": c["_src"],
                    }
                    for c in cs
                ],
            }
        )
        print(f"[{i}/{len(pdfs)}] {p.name[:60]:62} {d.get('comments',0):4d} ({','.join(d['strategies']) or 'NONE'})", flush=True)

    (OUT / "examiner-comments.json").write_text(json.dumps(records, ensure_ascii=False, indent=1))
    (OUT / "extraction-diagnostics.json").write_text(json.dumps(diags, ensure_ascii=False, indent=1))
    ok = sum(1 for d in diags if d.get("real_comments", 0) > 0)
    print(json.dumps({"pdfs": len(pdfs), "with_comments": ok, "without": len(pdfs) - ok,
                      "total_comments": sum(len(r["comments"]) for r in records)}, indent=2))


if __name__ == "__main__":
    main()
