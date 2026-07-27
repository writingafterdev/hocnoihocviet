#!/usr/bin/env python3
"""Precision of the model's most critical findings.

The product goal is not to find every error but to surface the few that move
the band. So: rank each run's findings by severity (major > moderate > minor),
take the top k, and ask what fraction land in a sentence the examiner marked.
That is the number a student experiences: of the things the app most loudly
flags, how many would a real examiner have flagged too?

    python3 scripts/score-critical.py --criterion tr --k 3 \
        --fixtures tmp/corpus/task_response-fixtures.json \
        --arm "shipped=tmp/ab/null-trfull-4.json"
"""
import argparse
import importlib.util
import json
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location("sl", "scripts/score-sentence-level.py")
sl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sl)

SEVERITY_RANK = {"major": 0, "moderate": 1, "minor": 2}


def measure(path: Path, fixtures, field, k):
    if not path.exists():
        return None
    entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
    precisions, majors = [], 0
    picked = 0
    for fixture in fixtures:
        entry = entries.get(fixture["fileId"])
        if not entry:
            continue
        essay = sl.normalize(fixture["essay"])
        bounds = sl.sentence_bounds(essay)
        wanted = set()
        for anchor in fixture.get(field, []):
            if sl.is_praise(anchor["comment"]):
                continue
            at = essay.find(sl.normalize(anchor["anchoredText"]))
            if at >= 0:
                wanted.add(sl.sentence_of(at, bounds))
        if not wanted:
            continue
        for run in entry.get("runs") or [{"findings": entry.get("findings", [])}]:
            ranked = sorted(
                run.get("findings", []),
                key=lambda f: SEVERITY_RANK.get(str(f.get("severity", "minor")), 3),
            )[:k]
            if not ranked:
                continue
            hits = 0
            for finding in ranked:
                if str(finding.get("severity")) == "major":
                    majors += 1
                touched = set()
                for evidence in finding.get("evidence", []):
                    quote = sl.normalize(evidence.get("sourceText", ""))
                    at = essay.find(quote) if quote else -1
                    if at < 0:
                        continue
                    for index, (start, end) in enumerate(bounds):
                        if start < at + len(quote) and at < end:
                            touched.add(index)
                if touched & wanted:
                    hits += 1
            picked += len(ranked)
            precisions.append(hits / len(ranked))
    if not precisions:
        return None
    return {"precision": statistics.mean(precisions), "picked": picked, "majors": majors,
            "runs": len(precisions)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--criterion", required=True, choices=sorted(sl.ANCHOR_FIELD))
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--k", type=int, default=3)
    parser.add_argument("--arm", action="append", required=True)
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    field = sl.ANCHOR_FIELD[args.criterion]
    print(f"\n{args.criterion}: precision of top-{args.k} findings by severity\n")
    print(f"  {'arm':26} {'precision@k':>11} {'picked':>7} {'majors':>7} {'runs':>6}")
    print(f"  {'-' * 62}")
    for spec_arg in args.arm:
        label, _, path = spec_arg.partition("=")
        stats = measure(Path(path), fixtures, field, args.k)
        if not stats:
            print(f"  {label:26} {'(missing)':>11}")
            continue
        print(f"  {label:26} {stats['precision']*100:10.1f}% {stats['picked']:7} "
              f"{stats['majors']:7} {stats['runs']:6}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
