#!/usr/bin/env python3
"""Score two prompt variants against the tutor answer key.

Reads the JSON each variant produced (`tmp/ab/result-*.json`) and compares it to
the lexical anchors a human marker left on the same essays. Reports recall, the
number of findings produced, and evidence exactness.

    python3 scripts/score-prompt-ab.py --a tmp/ab/result-old.json --b tmp/ab/result-new.json
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def spans_for(entry, essay):
    """Character ranges a variant pointed at, plus how many quotes were verbatim."""
    spans, exact, total = [], 0, 0
    haystack = normalize(essay)
    for finding in entry.get("findings", []):
        for evidence in finding.get("evidence", []):
            quote = normalize(evidence.get("sourceText", ""))
            if not quote:
                continue
            total += 1
            at = haystack.find(quote)
            if at >= 0:
                exact += 1
                spans.append((at, at + len(quote)))
    return spans, exact, total


def per_run_recall(entry, fixture):
    """Mean recall across repeated runs, when the runner kept them all.

    Averaging beats scoring any single run on an unstable provider, where the
    same essay can yield 0, 0 and 12 findings.
    """
    runs = entry.get("runs")
    if not runs:
        return None
    haystack = normalize(fixture["essay"])
    anchors = []
    for anchor in fixture["lrAnchors"]:
        needle = normalize(anchor["anchoredText"])
        at = haystack.find(needle)
        if at >= 0:
            anchors.append((at, at + len(needle)))
    if not anchors:
        return None
    rates = []
    for run in runs:
        spans = []
        for finding in run.get("findings", []):
            for evidence in finding.get("evidence", []):
                quote = normalize(evidence.get("sourceText", ""))
                at = haystack.find(quote) if quote else -1
                if at >= 0:
                    spans.append((at, at + len(quote)))
        hits = sum(1 for a_start, a_end in anchors if any(s < a_end and a_start < e for s, e in spans))
        rates.append(hits / len(anchors))
    return sum(rates) / len(rates)


def score(path: Path, fixtures):
    entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
    hit = miss = findings = exact = quotes = 0
    grounded = [0, 0]
    run_rates = []
    per_essay = []
    for fixture in fixtures:
        entry = entries.get(fixture["fileId"])
        if entry is None:
            per_essay.append((fixture["docTitle"], 0, 0, len(fixture["lrAnchors"])))
            miss += len(fixture["lrAnchors"])
            continue
        spans, e_exact, e_total = spans_for(entry, fixture["essay"])
        exact += e_exact
        quotes += e_total
        findings += len(entry.get("findings", []))
        essay_hits = 0
        haystack = normalize(fixture["essay"])
        for anchor in fixture["lrAnchors"]:
            needle = normalize(anchor["anchoredText"])
            at = haystack.find(needle)
            if at < 0:
                continue
            a_start, a_end = at, at + len(needle)
            if any(s < a_end and a_start < e for s, e in spans):
                essay_hits += 1
        hit += essay_hits
        miss += len(fixture["lrAnchors"]) - essay_hits

        # Precision proxy: a finding lands on text some human marker also chose to
        # comment on, under any criterion. Recall alone rewards flooding.
        for finding in entry.get("findings", []):
            f_spans = []
            for evidence in finding.get("evidence", []):
                quote = normalize(evidence.get("sourceText", ""))
                at = haystack.find(quote) if quote else -1
                if at >= 0:
                    f_spans.append((at, at + len(quote)))
            landed = False
            for anchor in fixture.get("allAnchors", fixture["lrAnchors"]):
                needle = normalize(anchor["anchoredText"])
                at = haystack.find(needle)
                if at < 0:
                    continue
                if any(s < at + len(needle) and at < e for s, e in f_spans):
                    landed = True
                    break
            grounded[0] += 1 if landed else 0
            grounded[1] += 1
        rate = per_run_recall(entry, fixture)
        if rate is not None:
            run_rates.append(rate)
        per_essay.append((fixture["docTitle"], len(entry.get("findings", [])), essay_hits, len(fixture["lrAnchors"])))
    return {
        "meanRunRecall": (sum(run_rates) / len(run_rates)) if run_rates else None,
        "recall": hit / max(1, hit + miss),
        "findings": findings,
        "exactRate": exact / max(1, quotes),
        "quotes": quotes,
        "grounded": grounded[0] / max(1, grounded[1]),
        "perEssay": per_essay,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--a", default="tmp/ab/result-old.json")
    parser.add_argument("--b", default="tmp/ab/result-new.json")
    parser.add_argument("--fixtures", default="tmp/ab/fixtures.json")
    parser.add_argument("--label-a", default="old prompt")
    parser.add_argument("--label-b", default="new prompt")
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    human_total = sum(len(f["lrAnchors"]) for f in fixtures)
    print(f"{len(fixtures)} essays, {human_total} human lexical anchors\n")

    for label, path in ((args.label_a, Path(args.a)), (args.label_b, Path(args.b))):
        if not path.exists():
            print(f"{label:12} — {path} missing")
            continue
        result = score(path, fixtures)
        print(
            f"{label:12} findings {result['findings']:3d}   "
            f"recall {result['recall'] * 100:5.1f}%   "
            f"verbatim {result['exactRate'] * 100:5.1f}%   "
            f"on human-marked text {result['grounded'] * 100:5.1f}%"
            + (f"   mean-per-run recall {result['meanRunRecall'] * 100:5.1f}%" if result.get('meanRunRecall') is not None else "")
        )
        for title, n, hits, total in result["perEssay"]:
            print(f"    {title[:44]:46} {n:2d} findings   {hits:2d}/{total} anchors")
        print()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        # Piping into head closes stdout early; that is not a failure.
        raise SystemExit(0)
