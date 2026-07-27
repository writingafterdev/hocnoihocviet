#!/usr/bin/env python3
"""Put every feedback source on one scale.

Compares how the criterion mix and annotation density differ between the humans
we are trying to imitate and the systems doing the imitating:

  tutors    43 essays marked by the in-house team
  examiners 128 marked IELTS scripts
  reference the generated assessments stored in Appwrite
  a variant any A/B run (tmp/ab/result-*.json)

Criterion share is the number to watch. The generated assessments invert the two
largest human categories, and no aggregate score reveals that.

    python3 scripts/compare-sources.py
    python3 scripts/compare-sources.py --variant tmp/ab/result-new.json --variant-label "new prompt"
"""
import argparse
import json
import re
import statistics
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "tmp" / "corpus"

CRITERIA = [
    "lexical_resource",
    "task_response",
    "grammatical_range_accuracy",
    "cohesion",
    "coherence",
]
LABELS = {
    "lexical_resource": "Lexical Resource",
    "task_response": "Task Response",
    "grammatical_range_accuracy": "Grammar",
    "cohesion": "Cohesion",
    "coherence": "Coherence",
}
# The reference engine writes criterion names in prose form.
REFERENCE_ALIASES = {
    "task response": "task_response",
    "coherence": "coherence",
    "cohesion": "cohesion",
    "lexical resource": "lexical_resource",
    "grammar": "grammatical_range_accuracy",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def tutor_source():
    rows = load_json(CORPUS / "tutor-comments-labelled.json")
    if not rows:
        return None
    counts = Counter(r["crit"] for r in rows if r["crit"] in CRITERIA)
    per_essay = Counter(r["e"] for r in rows)
    return counts, list(per_essay.values()), "43 essays, in-house marking team"


def examiner_source():
    rows = load_json(CORPUS / "classified-comments.json")
    if not rows:
        return None
    problems = [r for r in rows if r.get("criterion") in CRITERIA and r.get("kind") != "summary"]
    counts = Counter(r["criterion"] for r in problems)
    per_script = Counter(r["pdf"] for r in problems)
    return counts, list(per_script.values()), "128 marked IELTS scripts"


def reference_source():
    rows = load_json(CORPUS / "youpass-assessments.json")
    if not rows:
        return None
    counts, per_essay = Counter(), []
    for row in rows:
        blocks = re.split(r"^### Error \d+:", row.get("assessmentMarkdown", ""), flags=re.M)[1:]
        found = 0
        for block in blocks:
            label = (re.search(r"^Criterion:\s*(.+)$", block, re.M) or [None, ""])[1].strip().lower()
            key = REFERENCE_ALIASES.get(label) or next(
                (v for k, v in REFERENCE_ALIASES.items() if k in label), None
            )
            if key:
                counts[key] += 1
                found += 1
        if blocks:
            per_essay.append(found)
    return counts, per_essay, f"{len(per_essay)} generated assessments"


def variant_source(path: Path, label: str):
    rows = load_json(path)
    if not rows:
        return None
    counts, per_essay = Counter(), []
    for entry in rows:
        findings = entry.get("findings", [])
        per_essay.append(len(findings))
        for finding in findings:
            key = finding.get("criterion")
            if key in CRITERIA:
                counts[key] += 1
    return counts, per_essay, f"{len(per_essay)} essays — {label}"


def render(name, packed):
    counts, per_essay, note = packed
    total = sum(counts.values()) or 1
    shares = "  ".join(f"{counts.get(c, 0) / total * 100:5.1f}%" for c in CRITERIA)
    median = statistics.median(per_essay) if per_essay else 0
    print(f"  {name:14} {shares}   {median:5.0f}   {total:6d}   {note}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", action="append", default=[])
    parser.add_argument("--variant-label", action="append", default=[])
    args = parser.parse_args()

    header = "  ".join(f"{LABELS[c][:9]:>6}" for c in CRITERIA)
    print(f"\n  {'source':14} {header}   median   total   basis")
    print(f"  {'-' * 92}")

    for name, loader in (("tutors", tutor_source), ("examiners", examiner_source), ("reference", reference_source)):
        packed = loader()
        if packed:
            render(name, packed)
        else:
            print(f"  {name:14} (corpus not built)")

    for index, raw in enumerate(args.variant):
        label = args.variant_label[index] if index < len(args.variant_label) else Path(raw).stem
        packed = variant_source(Path(raw), label)
        if packed:
            render(label[:14], packed)
        else:
            print(f"  {label[:14]:14} ({raw} missing)")

    print("\n  median = annotations per essay. Human markers write far more than the")
    print("  generated assessments do, and weight the criteria differently.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
