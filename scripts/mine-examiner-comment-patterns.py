#!/usr/bin/env python3
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path.cwd()
CORPUS_DIR = ROOT / "tmp" / "marked-script-comment-corpus"
NORMALIZED = CORPUS_DIR / "examiner-comment-normalized.jsonl"
SOURCE_SUMMARY = CORPUS_DIR / "examiner-source-summary.jsonl"


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def score_value(raw):
    if not raw:
        return None
    raw = raw.replace(" ", "")
    parts = raw.split("/")
    nums = []
    for part in parts:
        try:
            nums.append(float(part))
        except ValueError:
            pass
    if not nums:
        return None
    return sum(nums) / len(nums)


def filename_band(source):
    matches = re.findall(r"(?:band[-_ ]?|^|[-_ ])(\d(?:[._-]\d)?)", source, re.I)
    if not matches:
        return None
    value = matches[-1].replace("_", ".").replace("-", ".")
    try:
        return float(value)
    except ValueError:
        return None


def infer_source_band(summary):
    overall_values = []
    criterion_values = defaultdict(list)
    for mention in summary.get("score_mentions", []):
        label = mention["label"].lower()
        value = score_value(mention["value"])
        if value is None:
            continue
        if label == "overall":
            overall_values.append(value)
        elif "task" in label or label == "tr":
            criterion_values["TR"].append(value)
        elif "cohesion" in label or "coherence" in label or label == "cc":
            criterion_values["CC"].append(value)
        elif "vocabulary" in label or "lexical" in label or label == "lr":
            criterion_values["LR"].append(value)
        elif "grammar" in label or label == "gra":
            criterion_values["GRA"].append(value)
    inferred = {
        "overall": overall_values[0] if overall_values else filename_band(summary["source_pdf"]),
        "criteria": {key: values[0] for key, values in criterion_values.items() if values},
        "score_source": "comment_score" if overall_values else ("filename" if filename_band(summary["source_pdf"]) else None),
    }
    return inferred


def bucket_band(value):
    if value is None:
        return "unknown"
    if value < 6:
        return "5.x"
    if value < 6.5:
        return "6.0"
    if value < 7:
        return "6.5"
    if value < 7.5:
        return "7.0"
    if value < 8:
        return "7.5"
    return "8+"


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def write_report(path, rows, sources, source_bands):
    critical_rows = [
        row
        for row in rows
        if row["polarity"] in {"critical", "mixed"}
        and row["severity_hint"] not in {"artifact", "score_metadata"}
    ]
    hard_rows = [row for row in critical_rows if row["severity_hint"] in {"major", "medium", "minor_or_local"}]

    chunks = ["# Examiner Pattern Mining Report", ""]
    chunks.append(f"Normalized rows: {len(rows)}")
    chunks.append(f"Actionable critical/mixed rows: {len(critical_rows)}")
    chunks.append(f"Rows with usable criterion/severity labels: {len(hard_rows)}")
    chunks.append("")

    chunks.append("## Most Common Issue Families In Critical Rows")
    chunks.append("")
    issue_counts = Counter(family for row in critical_rows for family in row["issue_families"])
    for issue, count in issue_counts.most_common(30):
        chunks.append(f"- {issue}: {count}")
    chunks.append("")

    chunks.append("## Critical Rows By Criterion")
    chunks.append("")
    criterion_counts = Counter(row["primary_criterion"] or "UNCLASSIFIED" for row in critical_rows)
    for criterion, count in criterion_counts.most_common():
        chunks.append(f"- {criterion}: {count}")
    chunks.append("")

    chunks.append("## Criterion x Issue Family")
    chunks.append("")
    by_criterion_issue = defaultdict(Counter)
    for row in critical_rows:
        criterion = row["primary_criterion"] or "UNCLASSIFIED"
        for issue in row["issue_families"] or ["unlabeled"]:
            by_criterion_issue[criterion][issue] += 1
    for criterion in ["TR", "CC", "LR", "GRA", "UNCLASSIFIED"]:
        chunks.append(f"### {criterion}")
        chunks.append("")
        for issue, count in by_criterion_issue[criterion].most_common(15):
            chunks.append(f"- {issue}: {count}")
        chunks.append("")

    chunks.append("## Band Buckets From Source-Level Score Hints")
    chunks.append("")
    bucket_counts = Counter(bucket_band(item["overall"]) for item in source_bands.values())
    for bucket, count in bucket_counts.most_common():
        chunks.append(f"- {bucket}: {count} sources")
    chunks.append("")

    chunks.append("## Band Bucket x Critical Issue Family")
    chunks.append("")
    by_bucket_issue = defaultdict(Counter)
    for row in critical_rows:
        source_band = source_bands.get(row["source_pdf"], {})
        bucket = bucket_band(source_band.get("overall"))
        for issue in row["issue_families"] or ["unlabeled"]:
            by_bucket_issue[bucket][issue] += 1
    for bucket in ["5.x", "6.0", "6.5", "7.0", "7.5", "8+", "unknown"]:
        chunks.append(f"### {bucket}")
        chunks.append("")
        for issue, count in by_bucket_issue[bucket].most_common(12):
            chunks.append(f"- {issue}: {count}")
        chunks.append("")

    chunks.append("## Examiner Lessons To Compare Against Mimo")
    chunks.append("")
    chunks.append("- TR: examiner comments frequently target whether the answer addresses the exact question, keeps a clear position, develops a point beyond one sentence, and avoids switching sides or drifting back to a different prompt.")
    chunks.append("- CC: examiner comments are less about decorative linking words and more about paragraph focus, topic sentences, logical order, referencing, substitution, and whether one sentence genuinely follows from the last.")
    chunks.append("- LR: examiner comments often separate high-level vocabulary from wrong collocation, wrong meaning, informal phrasing, over-paraphrase, and made-up translated phrases.")
    chunks.append("- GRA: examiner comments often tolerate some complexity, but repeated small mistakes, run-on sentences, articles, tense, countability, punctuation, and clause control are the recurring local penalties.")
    chunks.append("- Score boundary: many comments say a row could drop to 6/weak 7 because mistakes accumulate, so the prompt must not score criteria independently from the density/severity of findings.")
    chunks.append("")
    chunks.append("Caveat: source-level band buckets are approximate for PDFs containing multiple essays. Use row-level comments for taxonomy and source-level buckets only as a first calibration signal.")
    path.write_text("\n".join(chunks))


def main():
    rows = read_jsonl(NORMALIZED)
    sources = read_jsonl(SOURCE_SUMMARY)
    source_bands = {source["source_pdf"]: infer_source_band(source) for source in sources}

    write_json(CORPUS_DIR / "examiner-source-band-hints.json", source_bands)

    critical_rows = [
        row
        for row in rows
        if row["polarity"] in {"critical", "mixed"}
        and row["severity_hint"] not in {"artifact", "score_metadata"}
    ]

    pattern_summary = {
        "row_count": len(rows),
        "source_count": len(sources),
        "critical_or_mixed_rows": len(critical_rows),
        "critical_by_criterion": Counter(row["primary_criterion"] or "UNCLASSIFIED" for row in critical_rows),
        "critical_issue_families": Counter(family for row in critical_rows for family in row["issue_families"]),
        "band_buckets": Counter(bucket_band(item["overall"]) for item in source_bands.values()),
    }
    write_json(CORPUS_DIR / "examiner-pattern-summary.json", pattern_summary)
    write_report(CORPUS_DIR / "examiner-pattern-mining-report.md", rows, sources, source_bands)
    print(json.dumps(pattern_summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
