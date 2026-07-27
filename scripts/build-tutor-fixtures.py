#!/usr/bin/env python3
"""Build evaluation fixtures from the tutor-marked essay corpus.

Reads the Google Docs export in `sample essay/` — 43 essays marked by the
in-house tutor team, with 771 comments, 770 of them anchored to an exact span
of the student's text — and emits fixtures that scripts/eval-assessment-recall.ts
scores a pipeline against.

Each tutor comment becomes a recall target: a character range in the essay that
a competent assessment ought to say something about.

    python3 scripts/build-tutor-fixtures.py
    python3 scripts/build-tutor-fixtures.py --out tmp/corpus/fixtures.json
"""
import argparse
import csv
import difflib
import json
import re
import statistics
import sys
from pathlib import Path

csv.field_size_limit(10**9)

SOURCE_DIR = Path("sample essay")
ESSAYS_CSV = SOURCE_DIR / "Copy of Kho bài chấm T8 - Essays.csv"
FEEDBACK_CSV = SOURCE_DIR / "Copy of Kho bài chấm T8 - Feedback Extract.csv"

# Task prompts are pasted above the essay; these cues separate a prompt from prose.
PROMPT_CUE = re.compile(
    r"\?|to what extent|discuss|do you (think|agree)|outweigh"
    r"|advantages and disadvantages|give your opinion",
    re.I,
)
FUZZY_THRESHOLD = 0.75


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def split_prompt(text: str):
    """Return (task_prompt, essay). The prompt is empty when it can't be recovered."""
    text = text.strip()
    blocks = [b for b in re.split(r"\n\s*\n", text) if b.strip()]
    if len(blocks) >= 2 and len(blocks[0].split()) <= 90 and PROMPT_CUE.search(blocks[0]):
        return blocks[0].strip(), "\n\n".join(blocks[1:]).strip()

    # Some docs run the prompt into the first paragraph; cut at the last '?' near the top.
    head = " ".join(text.split()[:90])
    marks = list(re.finditer(r"\?", head))
    if marks:
        question = head[: marks[-1].end()].strip()
        if question in text:
            rest = text[text.find(question) + len(question):].strip()
            if len(rest.split()) >= 120:
                return question, rest
    return "", text


def resolve_anchor(anchor: str, essay: str):
    """Locate a tutor's quoted span in the essay. Returns (start, end, match_kind)."""
    needle, haystack = normalize(anchor), normalize(essay)
    index = haystack.find(needle)
    if index >= 0:
        return index, index + len(needle), "exact"

    index = haystack.lower().find(needle.lower())
    if index >= 0:
        return index, index + len(needle), "case"

    # Tutors sometimes retype or lightly edit the quote; accept a close window.
    width = len(needle)
    if width < 12 or width > len(haystack):
        return -1, -1, "unresolved"
    best_ratio, best_at = 0.0, -1
    for start in range(0, len(haystack) - width + 1, max(1, width // 8)):
        ratio = difflib.SequenceMatcher(None, needle, haystack[start:start + width]).quick_ratio()
        if ratio > best_ratio:
            best_ratio, best_at = ratio, start
    if best_at >= 0:
        exact_ratio = difflib.SequenceMatcher(
            None, needle, haystack[best_at:best_at + width]
        ).ratio()
        if exact_ratio >= FUZZY_THRESHOLD:
            return best_at, best_at + width, "fuzzy"
    return -1, -1, "unresolved"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="tmp/corpus/fixtures.json")
    parser.add_argument("--min-anchors", type=int, default=4)
    parser.add_argument(
        "--labels",
        default="tmp/corpus/tutor-comments-labelled.json",
        help="Optional criterion labels, keyed by anchored text plus comment.",
    )
    args = parser.parse_args()

    # Criterion labels let the harness report recall per criterion instead of one
    # blended number, which is the only view that shows a criterion going blind.
    labels = {}
    label_path = Path(args.labels)
    if label_path.exists():
        for row in json.loads(label_path.read_text(encoding="utf-8")):
            labels[(normalize(row.get("a", "")), normalize(row.get("c", "")))] = row.get("crit")

    if not ESSAYS_CSV.exists():
        print(f"Missing {ESSAYS_CSV}", file=sys.stderr)
        return 1

    essays = {row["File ID"]: row for row in csv.DictReader(ESSAYS_CSV.open(encoding="utf-8"))}
    feedback = list(csv.DictReader(FEEDBACK_CSV.open(encoding="utf-8")))

    fixtures, match_kinds = [], {}
    for file_id, row in essays.items():
        comments = [
            c for c in feedback
            if c["File ID"] == file_id and c["Type"] == "Comment" and c["Anchored Text"].strip()
        ]
        if not comments:
            continue
        question, essay = split_prompt(row["Original Essay"])
        anchors = []
        for comment in comments:
            start, end, kind = resolve_anchor(comment["Anchored Text"], essay)
            match_kinds[kind] = match_kinds.get(kind, 0) + 1
            anchor_text = comment["Anchored Text"].strip()
            body = comment["Suggestion / Comment"].strip()
            anchors.append({
                "anchoredText": anchor_text,
                "comment": body,
                "commenter": comment["Commenter"],
                "criterion": labels.get((normalize(anchor_text), normalize(body))),
                "startChar": start,
                "endChar": end,
                "match": kind,
                "resolved": kind != "unresolved",
                "anchorWords": len(normalize(anchor_text).split()),
            })
        fixtures.append({
            "fileId": file_id,
            "docTitle": row["Doc Title"],
            "question": question,
            "essay": essay,
            "correctedEssay": row["Corrected Essay"],
            "anchors": anchors,
            "essayWords": len(essay.split()),
            "nAnchors": len(anchors),
            "nResolved": sum(a["resolved"] for a in anchors),
        })

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixtures, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(f["nAnchors"] for f in fixtures)
    resolved = sum(f["nResolved"] for f in fixtures)
    usable = [f for f in fixtures if f["question"] and f["nResolved"] >= args.min_anchors]
    print(f"fixtures            {len(fixtures)}")
    print(f"anchors             {total} -> resolved {resolved} ({resolved / total * 100:.1f}%)")
    print(f"  by match kind     {match_kinds}")
    print(f"usable fixtures     {len(usable)} (question recovered and >= {args.min_anchors} anchors)")
    print(f"tutor comments/essay median {statistics.median(f['nAnchors'] for f in fixtures):.0f}")
    if labels:
        by_criterion: dict[str, int] = {}
        for fixture in fixtures:
            for anchor in fixture["anchors"]:
                key = anchor["criterion"] or "unlabelled"
                by_criterion[key] = by_criterion.get(key, 0) + 1
        total_labelled = sum(count for key, count in by_criterion.items() if key != "unlabelled")
        print("criterion mix       " + "  ".join(
            f"{key} {count} ({count / max(1, total_labelled) * 100:.0f}%)"
            for key, count in sorted(by_criterion.items(), key=lambda item: -item[1])
        ))
    print(f"wrote               {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
