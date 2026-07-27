#!/usr/bin/env python3
"""Report the model x prompt matrix against the tutor answer key.

Separates two questions that are easy to tangle:
  across columns -> does the prompt change help?
  across rows    -> is the model the bottleneck?

Every cell is scored the same way: mean recall across repeated runs against the
lexical anchors a human marker left, plus band spread on identical input.

    python3 scripts/report-model-prompt-matrix.py
"""
import argparse
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def cell(path: Path, fixtures):
    """Mean per-run recall, findings per essay, and band spread for one variant."""
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
        for anchor in fixture["lrAnchors"]:
            needle = normalize(anchor["anchoredText"])
            at = haystack.find(needle)
            if at >= 0:
                anchors.append((at, at + len(needle)))
        if not anchors:
            continue
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
        "bandSpread": statistics.mean(spreads) if spreads else 0.0,
        "verbatim": verbatim / max(1, quotes),
        "runs": len(recalls),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", default="tmp/ab/fixtures.json")
    args = parser.parse_args()

    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    human = statistics.mean(len(f["lrAnchors"]) for f in fixtures)

    matrix = [
        ("mimo-v2.5", "old", "tmp/ab/result-lex-old-mimo.json"),
        ("mimo-v2.5", "new", "tmp/ab/result-lex-new-mimo.json"),
        ("mimo-v2.5-pro", "old", "tmp/ab/result-lex-old-pro.json"),
        ("mimo-v2.5-pro", "new", "tmp/ab/result-lex-new-pro.json"),
        ("stand-in model", "old", "tmp/ab/result-old.json"),
        ("stand-in model", "new", "tmp/ab/result-new.json"),
    ]

    print(f"\n{len(fixtures)} essays, {human:.0f} human lexical anchors per essay\n")
    print(f"  {'model':16} {'prompt':7} {'recall':>8} {'findings/essay':>15} {'band spread':>12} {'verbatim':>9}")
    print(f"  {'-' * 74}")
    for model, prompt, path in matrix:
        stats = cell(ROOT / path, fixtures)
        if not stats:
            print(f"  {model:16} {prompt:7} {'(missing)':>8}")
            continue
        print(
            f"  {model:16} {prompt:7} {stats['recall'] * 100:7.1f}% {stats['findings']:15.1f} "
            f"{stats['bandSpread']:12.1f} {stats['verbatim'] * 100:8.1f}%"
        )
    print(f"\n  human marker{'':4} {'':7} {'100.0%':>8} {human:15.1f}")
    print("\n  recall is averaged across every run, not a single sample.")
    print("  band spread is max minus min band on the SAME essay across runs; 0 is deterministic.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
