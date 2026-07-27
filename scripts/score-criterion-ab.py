#!/usr/bin/env python3
"""Score a criterion's A/B arms against that criterion's human anchors.

score-prompt-ab.py is hard-wired to the lexical anchors. This takes the
criterion as an argument so grammar, task response and cohesion can be scored
the same way, on the same fixtures, and compared across models.

    python3 scripts/score-criterion-ab.py --criterion gra \
        --arm "old/mimo=tmp/ab/result-gra-old-mimo.json" \
        --arm "new/mimo=tmp/ab/result-gra-new-mimo.json"
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


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def score(path: Path, fixtures, field):
    if not path.exists():
        return None
    entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
    recalls, counts, spreads, verbatim, quotes = [], [], [], 0, 0
    for fixture in fixtures:
        entry = entries.get(fixture["fileId"])
        if not entry:
            continue
        haystack = normalize(fixture["essay"])
        anchors = []
        for anchor in fixture.get(field, []):
            needle = normalize(anchor["anchoredText"])
            at = haystack.find(needle)
            if at >= 0:
                anchors.append((at, at + len(needle)))
        if not anchors:
            continue
        # A single-run file has no `runs`; treat it as one run so both shapes score.
        runs = entry.get("runs") or [{"band": entry.get("band"), "findings": entry.get("findings", [])}]
        bands = [r.get("band") for r in runs if isinstance(r.get("band"), (int, float))]
        if len(bands) > 1:
            spreads.append(max(bands) - min(bands))
        for run in runs:
            spans = []
            for finding in run.get("findings", []):
                for evidence in finding.get("evidence", []):
                    quote = normalize(evidence.get("sourceText", ""))
                    if not quote:
                        continue
                    quotes += 1
                    at = haystack.find(quote)
                    if at >= 0:
                        verbatim += 1
                        spans.append((at, at + len(quote)))
            hits = sum(1 for s, e in anchors if any(a < e and s < b for a, b in spans))
            recalls.append(hits / len(anchors))
            counts.append(len(run.get("findings", [])))
    if not recalls:
        return None
    return {
        "recall": statistics.mean(recalls),
        "findings": statistics.mean(counts),
        "spread": statistics.mean(spreads) if spreads else 0.0,
        "verbatim": verbatim / max(1, quotes),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--criterion", required=True, choices=sorted(ANCHOR_FIELD))
    parser.add_argument("--arm", action="append", required=True, help="label=path")
    parser.add_argument("--fixtures", default="tmp/ab/fixtures.json")
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    field = ANCHOR_FIELD[args.criterion]
    total = sum(len(f.get(field, [])) for f in fixtures)
    print(f"\n{args.criterion}: {len(fixtures)} essays, {total} human anchors\n")
    print(f"  {'arm':18} {'recall':>8} {'findings/essay':>15} {'band spread':>12} {'verbatim':>9}")
    print(f"  {'-' * 66}")
    for spec in args.arm:
        label, _, path = spec.partition("=")
        stats = score(Path(path), fixtures, field)
        if not stats:
            print(f"  {label:18} {'(missing)':>8}")
            continue
        print(
            f"  {label:18} {stats['recall'] * 100:7.1f}% {stats['findings']:15.1f} "
            f"{stats['spread']:12.1f} {stats['verbatim'] * 100:8.1f}%"
        )
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
