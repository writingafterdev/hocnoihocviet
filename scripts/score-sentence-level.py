#!/usr/bin/env python3
"""Score an A/B arm at sentence granularity instead of exact span overlap.

Span overlap is the right test for lexical and grammar, where a marker and the
model are both pointing at the same few words. It is the wrong test for
coherence and cohesion, where the marker's anchor is a paragraph-level
phenomenon that may be flagged anywhere in the affected sentence -- and where
anchors are often a single word ("this", "it") that no model would quote back.

Here a finding counts as a hit when it lands in the same sentence as the human
anchor. That is more forgiving and, for these two criteria, closer to what
agreement actually means.

    python3 scripts/score-sentence-level.py --criterion cohere \\
        --fixtures tmp/ab/cohere-clean-fixtures.json \\
        --arm "old=tmp/ab/res-cohere-old.json" --arm "new=tmp/ab/res-cohere-new.json"
"""
import argparse
import json
import re
import statistics
from pathlib import Path

ANCHOR_FIELD = {
    "lex": "lrAnchors",
    "gra": "graAnchors",
    "tr": "trAnchors",
    "coh": "cohAnchors",
    "cohere": "cohereAnchors",
}

PRAISE = re.compile(
    r"\b(good|great|nice|well done|excellent|clear|accurate|effective|strong"
    r"|perfect|correct|fine|better|improved|like this|yes|✓)\b", re.I)
NEGATIVE = re.compile(
    r"\b(not |n't|no |lack|missing|wrong|unclear|awkward|error|avoid|should"
    r"|need|too |confus|weak|vague|repeat)", re.I)


def is_praise(comment: str) -> bool:
    return bool(PRAISE.search(comment)) and not NEGATIVE.search(comment)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def sentence_bounds(essay: str):
    """Character ranges of each sentence, so a hit can be judged per sentence."""
    bounds, start = [], 0
    for match in re.finditer(r"[.!?]+[\s\"')\]]*", essay):
        bounds.append((start, match.end()))
        start = match.end()
    if start < len(essay):
        bounds.append((start, len(essay)))
    return bounds


def sentence_of(position: int, bounds):
    for index, (start, end) in enumerate(bounds):
        if start <= position < end:
            return index
    return -1


def score(path: Path, fixtures, field, drop_praise=True):
    if not path.exists():
        return None
    entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
    recalls, counts = [], []
    for fixture in fixtures:
        entry = entries.get(fixture["fileId"])
        if not entry:
            continue
        essay = normalize(fixture["essay"])
        bounds = sentence_bounds(essay)

        wanted = set()
        for anchor in fixture.get(field, []):
            if drop_praise and is_praise(anchor["comment"]):
                continue
            at = essay.find(normalize(anchor["anchoredText"]))
            if at >= 0:
                wanted.add(sentence_of(at, bounds))
        if not wanted:
            continue

        runs = entry.get("runs") or [{"findings": entry.get("findings", [])}]
        for run in runs:
            touched = set()
            for finding in run.get("findings", []):
                for evidence in finding.get("evidence", []):
                    quote = normalize(evidence.get("sourceText", ""))
                    at = essay.find(quote) if quote else -1
                    if at < 0:
                        continue
                    # A finding may span sentences; credit every one it covers.
                    for index, (start, end) in enumerate(bounds):
                        if start < at + len(quote) and at < end:
                            touched.add(index)
            recalls.append(len(wanted & touched) / len(wanted))
            counts.append(len(run.get("findings", [])))
    if not recalls:
        return None
    return {"recall": statistics.mean(recalls), "findings": statistics.mean(counts)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--criterion", required=True, choices=sorted(ANCHOR_FIELD))
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--arm", action="append", required=True, help="label=path")
    parser.add_argument("--keep-praise", action="store_true")
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    field = ANCHOR_FIELD[args.criterion]
    total = sum(
        1 for f in fixtures for a in f.get(field, [])
        if args.keep_praise or not is_praise(a["comment"])
    )
    print(f"\n{args.criterion}: {len(fixtures)} scripts, {total} anchors, sentence-level match\n")
    print(f"  {'arm':22} {'recall':>8} {'findings/essay':>16}")
    print(f"  {'-' * 48}")
    for spec in args.arm:
        label, _, path = spec.partition("=")
        stats = score(Path(path), fixtures, field, not args.keep_praise)
        if not stats:
            print(f"  {label:22} {'(missing)':>8}")
            continue
        print(f"  {label:22} {stats['recall'] * 100:7.1f}% {stats['findings']:15.1f}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
