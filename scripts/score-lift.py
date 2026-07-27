#!/usr/bin/env python3
"""Score recall against the coverage that produced it.

Recall alone rewards volume: a pass that quotes 40% of every essay collects
40% of the anchors without being any better at finding them. Lift divides
recall by the share of sentences the findings touch, so 1.0 means "no better
than spraying", and only clearly above 1.0 is discrimination.

    python3 scripts/score-lift.py --criterion coh \
        --fixtures tmp/ab/coh-recovered-fixtures.json \
        --arm "shipped=tmp/ab/null-cohrec-half-a.json"
"""
import argparse
import importlib.util
import json
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location("sl", "scripts/score-sentence-level.py")
sl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sl)


def measure(path: Path, fixtures, field, keep_praise=False):
    if not path.exists():
        return None
    entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
    covs, recs, counts = [], [], []
    for fixture in fixtures:
        entry = entries.get(fixture["fileId"])
        if not entry:
            continue
        essay = sl.normalize(fixture["essay"])
        bounds = sl.sentence_bounds(essay)
        wanted = set()
        for anchor in fixture.get(field, []):
            if not keep_praise and sl.is_praise(anchor["comment"]):
                continue
            at = essay.find(sl.normalize(anchor["anchoredText"]))
            if at >= 0:
                wanted.add(sl.sentence_of(at, bounds))
        if not wanted:
            continue
        for run in entry.get("runs") or [{"findings": entry.get("findings", [])}]:
            touched = set()
            for finding in run.get("findings", []):
                for evidence in finding.get("evidence", []):
                    quote = sl.normalize(evidence.get("sourceText", ""))
                    at = essay.find(quote) if quote else -1
                    if at < 0:
                        continue
                    for index, (start, end) in enumerate(bounds):
                        if start < at + len(quote) and at < end:
                            touched.add(index)
            covs.append(len(touched) / max(1, len(bounds)))
            recs.append(len(wanted & touched) / len(wanted))
            counts.append(len(run.get("findings", [])))
    if not recs:
        return None
    recall, coverage = statistics.mean(recs), statistics.mean(covs)
    return {"recall": recall, "coverage": coverage,
            "lift": recall / coverage if coverage else 0.0,
            "findings": statistics.mean(counts)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--criterion", required=True, choices=sorted(sl.ANCHOR_FIELD))
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--arm", action="append", required=True, help="label=path")
    parser.add_argument("--keep-praise", action="store_true")
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    field = sl.ANCHOR_FIELD[args.criterion]
    print(f"\n{args.criterion}: {len(fixtures)} scripts — lift = recall / sentence coverage\n")
    print(f"  {'arm':26} {'recall':>8} {'coverage':>9} {'lift':>7} {'find/essay':>11}")
    print(f"  {'-' * 66}")
    for spec_arg in args.arm:
        label, _, path = spec_arg.partition("=")
        stats = measure(Path(path), fixtures, field, args.keep_praise)
        if not stats:
            print(f"  {label:26} {'(missing)':>8}")
            continue
        print(f"  {label:26} {stats['recall']*100:7.1f}% {stats['coverage']*100:8.1f}% "
              f"{stats['lift']:6.2f}x {stats['findings']:10.1f}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
