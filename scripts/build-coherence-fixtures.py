#!/usr/bin/env python3
"""Build coherence fixtures from the examiner-marked script corpus.

The tutor corpus cannot test the coherence pass: 5 coherence comments across 43
essays, and none at all in the A/B sample. The examiner corpus is the only other
source, with 90 anchored coherence comments across 57 scripts.

Very few survive the filters, and that is worth knowing before trusting any
coherence number:

  90 anchored coherence comments
  -> drop scripts whose extracted body is not a single 200-600 word answer
     (many PDFs are whole teaching packets, rubric tables and all)
  -> drop anchors under 4 words (highlight-rect recovery truncates mid-word,
     leaving fragments like "zy with abbreviations")
  -> drop anchors that do not resolve exactly against the cleaned body
  = 7 anchors across 6 scripts

That is too thin to A/B a prompt on. It is preserved so the next attempt starts
here rather than from the PDFs, and so the bottleneck is visible: the limit is
anchor-recovery quality in extract-examiner-comments-fitz.py, not the corpus.

    python3 scripts/build-coherence-fixtures.py
"""
import argparse
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "tmp" / "corpus"

# Lines that belong to the marking apparatus rather than the student's answer.
RUBRIC = re.compile(
    r"^\s*(task\s*(achievement|response)|coherence|cohesion|lexical\s*resource"
    r"|vocabulary|grammat|grammar|overall|band|score|word\s*count|comment\s*\["
    r"|feedback|examiner)\b",
    re.I,
)
NOISE = re.compile(r"^\s*(page\s*\d+|\d+\s*$|www\.|http|ielts\s*answers|©)", re.I)

MIN_WORDS, MAX_WORDS = 200, 600
MIN_ANCHOR_WORDS = 4


def clean_essay(text: str) -> str:
    return "\n".join(
        line.strip()
        for line in text.split("\n")
        if line.strip() and not RUBRIC.match(line.strip()) and not NOISE.match(line.strip())
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="tmp/corpus/coherence-fixtures.json")
    args = parser.parse_args()

    comments_path = CORPUS / "examiner-comments.json"
    classified_path = CORPUS / "classified-comments.json"
    if not comments_path.exists() or not classified_path.exists():
        print("Run extract-examiner-comments-fitz.py and analyze-examiner-comments.py first.")
        return 1

    records = {r["sourcePdf"]: r for r in json.loads(comments_path.read_text(encoding="utf-8"))}
    classified = json.loads(classified_path.read_text(encoding="utf-8"))
    coherence = [
        c for c in classified
        if c["criterion"] == "coherence" and c.get("anchor", "").strip() and c["kind"] != "summary"
    ]

    fixtures, dropped_body, dropped_anchor = [], 0, 0
    for pdf in sorted({c["pdf"] for c in coherence}):
        record = records.get(pdf)
        if not record:
            continue
        essay = clean_essay(record.get("essay", "") or "")
        words = len(essay.split())
        if not MIN_WORDS <= words <= MAX_WORDS:
            dropped_body += 1
            continue
        haystack = re.sub(r"\s+", " ", essay)
        anchors = []
        for comment in (c for c in coherence if c["pdf"] == pdf):
            anchor = re.sub(r"\s+", " ", comment["anchor"]).strip()
            if len(anchor.split()) < MIN_ANCHOR_WORDS or anchor not in haystack:
                dropped_anchor += 1
                continue
            anchors.append({"anchoredText": anchor, "comment": comment["text"]})
        if anchors:
            fixtures.append({
                "sourcePdf": pdf,
                "band": record.get("bandFromFilename") or record.get("bandFromSummary"),
                "essay": essay,
                "essayWords": words,
                "cohAnchors": anchors,
            })

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixtures, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(f["cohAnchors"]) for f in fixtures)
    print(f"anchored coherence comments   {len(coherence)}")
    print(f"scripts dropped, body unusable {dropped_body}")
    print(f"anchors dropped, unresolvable  {dropped_anchor}")
    print(f"fixtures                       {len(fixtures)}  ({total} anchors)")
    if fixtures:
        print(f"essay words median             {statistics.median(f['essayWords'] for f in fixtures):.0f}")
    print(f"wrote                          {out_path}")
    if total < 20:
        print("\nToo thin to A/B a prompt on. Improve anchor recovery in")
        print("extract-examiner-comments-fitz.py before drawing conclusions from this set.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
