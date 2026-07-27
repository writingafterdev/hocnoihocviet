#!/usr/bin/env python3
"""Build per-criterion fixtures from the examiner-marked script corpus.

The tutor corpus is dense on lexical (48 anchors in three essays) and thin
everywhere else, which is why the first round of prompt tuning improved lexical
and grammar and left Task Response and Coherence unmeasured. The 128 examiner
scripts have a very different mix, and for Task Response they are five times
richer than the tutor set.

Yield per criterion, after requiring a clean 200-600 word answer and an anchor of
at least three words that resolves against the essay:

    task_response      513 anchored comments -> 159 anchors across 63 scripts
    lexical_resource   696                   -> 164 across 60
    grammar            183                   ->  38 across 29
    coherence           90                   ->  20 across 17
    cohesion            49                   ->   6 across  6

Four of the five are usable. Cohesion is not, and the script says so rather than
returning a number that looks like a measurement.

    python3 scripts/build-examiner-fixtures.py --criterion task_response
    python3 scripts/build-examiner-fixtures.py --criterion cohesion --out tmp/corpus/coh-fixtures.json
"""
import argparse
import difflib
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "tmp" / "corpus"

ANCHOR_KEY = {
    "task_response": "trAnchors",
    "coherence": "cohereAnchors",
    "cohesion": "cohAnchors",
    "lexical_resource": "lrAnchors",
    "grammatical_range_accuracy": "graAnchors",
}

# Lines belonging to the marking apparatus rather than the student's answer.
RUBRIC = re.compile(
    r"^\s*(task\s*(achievement|response)|coherence|cohesion|lexical\s*resource"
    r"|vocabulary|grammat|grammar|overall|band|score|word\s*count|comment\s*\["
    r"|feedback|examiner)\b",
    re.I,
)
NOISE = re.compile(r"^\s*(page\s*\d+|\d+\s*$|www\.|http|ielts\s*answers|©)", re.I)

MIN_WORDS, MAX_WORDS, MIN_ANCHOR_WORDS = 200, 600, 3

# Most scripts paste the task above the answer, sometimes behind a "Topic-" or
# "Task 2" label. Task Response cannot be judged without it.
PROMPT_CUE = re.compile(
    r"(to what extent|do you agree|discuss both|advantages and disadvantages"
    r"|outweigh|what are the (causes|problems)|give your (own )?opinion"
    r"|positive or negative|why.{0,60}what)",
    re.I,
)
PROMPT_LABEL = re.compile(r"^\s*(topic\s*[-:–]?\s*|task\s*2\s*[-:–]?\s*)", re.I)


def split_prompt(text: str):
    """Return (task_prompt, essay). Prompt is empty when it cannot be recovered."""
    stripped = PROMPT_LABEL.sub("", text.lstrip())
    head = " ".join(stripped.split()[:90])
    match = PROMPT_CUE.search(head)
    if not match:
        return "", text
    # The task ends at the first sentence break after the cue.
    tail = head[match.end():]
    stop = re.search(r"[.?!]", tail)
    cut = match.end() + (stop.end() if stop else 0)
    question = head[:cut].strip()
    if len(question.split()) < 8:
        return "", text
    remainder = stripped[len(question):].strip() if stripped.startswith(question) else stripped
    if len(remainder.split()) < MIN_WORDS:
        return "", text
    return question, remainder


def clean_essay(text: str) -> str:
    return "\n".join(
        line.strip()
        for line in text.split("\n")
        if line.strip() and not RUBRIC.match(line.strip()) and not NOISE.match(line.strip())
    )


FUZZY_THRESHOLD = 0.75


def resolve_anchor(anchor: str, haystack: str):
    """Locate an anchor in the essay, tolerating extraction damage.

    Highlight-rectangle recovery clips characters off the ends, so an anchor
    often arrives as "zy with abbreviations" rather than "...lazy with
    abbreviations". Requiring an exact substring throws away most of the corpus:
    on Task Response, exact matching keeps 153 anchors where a 0.75 similarity
    window keeps 364, with only 23 genuinely unrecoverable.
    """
    if anchor in haystack:
        return anchor, "exact"
    lowered = haystack.lower().find(anchor.lower())
    if lowered >= 0:
        return haystack[lowered:lowered + len(anchor)], "case"
    width = len(anchor)
    if width < 12 or width > len(haystack):
        return None, "unresolved"
    best_ratio, best_at = 0.0, -1
    for start in range(0, len(haystack) - width + 1, max(1, width // 8)):
        ratio = difflib.SequenceMatcher(None, anchor, haystack[start:start + width]).quick_ratio()
        if ratio > best_ratio:
            best_ratio, best_at = ratio, start
    if best_at >= 0:
        window = haystack[best_at:best_at + width]
        if difflib.SequenceMatcher(None, anchor, window).ratio() >= FUZZY_THRESHOLD:
            return window, "fuzzy"
    return None, "unresolved"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--criterion", required=True, choices=sorted(ANCHOR_KEY))
    parser.add_argument("--out")
    args = parser.parse_args()

    comments_path = CORPUS / "examiner-comments.json"
    classified_path = CORPUS / "classified-comments.json"
    if not comments_path.exists() or not classified_path.exists():
        print("Run extract-examiner-comments-fitz.py and analyze-examiner-comments.py first.")
        return 1

    records = {r["sourcePdf"]: r for r in json.loads(comments_path.read_text(encoding="utf-8"))}
    classified = json.loads(classified_path.read_text(encoding="utf-8"))
    wanted = [
        c for c in classified
        if c["criterion"] == args.criterion and c.get("anchor", "").strip() and c["kind"] != "summary"
    ]

    key = ANCHOR_KEY[args.criterion]
    fixtures, dropped_body, dropped_anchor = [], 0, 0
    match_kinds = {}
    for pdf in sorted({c["pdf"] for c in wanted}):
        record = records.get(pdf)
        if not record:
            continue
        cleaned = clean_essay(record.get("essay", "") or "")
        question, essay = split_prompt(cleaned)
        words = len(essay.split())
        if not MIN_WORDS <= words <= MAX_WORDS:
            dropped_body += 1
            continue
        haystack = re.sub(r"\s+", " ", essay)
        anchors = []
        for comment in (c for c in wanted if c["pdf"] == pdf):
            anchor = re.sub(r"\s+", " ", comment["anchor"]).strip()
            if len(anchor.split()) < MIN_ANCHOR_WORDS:
                dropped_anchor += 1
                continue
            resolved, kind = resolve_anchor(anchor, haystack)
            if resolved is None:
                dropped_anchor += 1
                continue
            match_kinds[kind] = match_kinds.get(kind, 0) + 1
            # Store the text as it appears in the essay so span matching is exact.
            anchors.append({"anchoredText": resolved, "comment": comment["text"], "match": kind})
        if anchors:
            fixtures.append({
                # fileId keeps the shape score-criterion-ab.py already reads.
                "fileId": pdf,
                "docTitle": pdf,
                "sourcePdf": pdf,
                "band": record.get("bandFromFilename") or record.get("bandFromSummary"),
                "question": question,
                "essay": essay,
                "essayWords": words,
                key: anchors,
            })

    out_path = Path(args.out or f"tmp/corpus/{args.criterion}-fixtures.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixtures, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(f[key]) for f in fixtures)
    print(f"anchored {args.criterion} comments  {len(wanted)}")
    print(f"scripts dropped, body unusable    {dropped_body}")
    print(f"anchors dropped, unresolvable     {dropped_anchor}")
    print(f"fixtures                          {len(fixtures)}  ({total} anchors)")
    print(f"anchor match kinds                {match_kinds}")
    if fixtures:
        print(f"anchors per script median         {statistics.median(len(f[key]) for f in fixtures):.0f}")
        print(f"anchor words median               {statistics.median(len(a['anchoredText'].split()) for f in fixtures for a in f[key]):.0f}")
    with_prompt = sum(1 for f in fixtures if f["question"])
    print(f"task prompt recovered             {with_prompt}/{len(fixtures)}")
    print(f"wrote                             {out_path}")
    if total < 20:
        print("\nToo thin to tune against. Improve anchor recovery in extract-examiner-comments-fitz.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
