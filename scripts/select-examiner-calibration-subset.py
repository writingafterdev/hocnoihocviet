#!/usr/bin/env python3
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path.cwd()
CORPUS_DIR = ROOT / "tmp" / "marked-script-comment-corpus"
SOURCE_SUMMARY = CORPUS_DIR / "examiner-source-summary.jsonl"
NORMALIZED = CORPUS_DIR / "examiner-comment-normalized.jsonl"
OUT_JSON = CORPUS_DIR / "examiner-calibration-subset.json"
OUT_MD = CORPUS_DIR / "examiner-calibration-subset.md"
HELDOUT_JSON = CORPUS_DIR / "examiner-heldout-sources.json"


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def score_value(raw):
    raw = raw.replace(" ", "")
    nums = []
    for part in raw.split("/"):
        try:
            nums.append(float(part))
        except ValueError:
            pass
    return sum(nums) / len(nums) if nums else None


def infer_band_from_scores(summary):
    overall = []
    criteria = defaultdict(list)
    for mention in summary.get("score_mentions", []):
        label = mention["label"].lower()
        value = score_value(mention["value"])
        if value is None or value < 4 or value > 9:
            continue
        if label == "overall":
            overall.append(value)
        elif "task" in label or label == "tr":
            criteria["TR"].append(value)
        elif "cohesion" in label or "coherence" in label or label == "cc":
            criteria["CC"].append(value)
        elif "vocabulary" in label or "lexical" in label or label == "lr":
            criteria["LR"].append(value)
        elif "grammar" in label or label == "gra":
            criteria["GRA"].append(value)
    return {
        "overall": overall[0] if overall else None,
        "criteria": {key: values[0] for key, values in criteria.items() if values},
        "score_source": "comment_score" if overall else None,
    }


def band_bucket(value):
    if value is None:
        return "unknown"
    if value < 6.25:
        return "low_5_to_6"
    if value < 7.0:
        return "mid_6_5"
    if value < 8.0:
        return "high_7_to_7_5"
    return "upper_8_plus"


def source_issue_stats(rows):
    by_source = defaultdict(list)
    for row in rows:
        by_source[row["source_pdf"]].append(row)

    stats = {}
    for source, items in by_source.items():
        critical = [
            item
            for item in items
            if item["polarity"] in {"critical", "mixed"}
            and item["severity_hint"] not in {"artifact", "score_metadata"}
        ]
        stats[source] = {
            "critical_rows": len(critical),
            "major_rows": sum(1 for item in critical if item["severity_hint"] == "major"),
            "criteria": dict(Counter(item["primary_criterion"] or "UNCLASSIFIED" for item in critical)),
            "issues": dict(Counter(issue for item in critical for issue in item["issue_families"])),
            "has_tr": any((item["primary_criterion"] == "TR") for item in critical),
            "has_cc": any((item["primary_criterion"] == "CC") for item in critical),
            "has_lr": any((item["primary_criterion"] == "LR") for item in critical),
            "has_gra": any((item["primary_criterion"] == "GRA") for item in critical),
        }
    return stats


def quality_score(summary, issue_stats):
    stats = issue_stats.get(summary["source_pdf"], {})
    criteria_count = sum(1 for key in ["has_tr", "has_cc", "has_lr", "has_gra"] if stats.get(key))
    return (
        min(summary["row_count"], 60) * 1.0
        + stats.get("critical_rows", 0) * 3.0
        + stats.get("major_rows", 0) * 2.0
        + criteria_count * 8.0
        + (12.0 if summary["score_info"]["overall"] is not None else 0.0)
    )


def target_counts():
    return {
        "low_5_to_6": 10,
        "mid_6_5": 10,
        "high_7_to_7_5": 8,
        "upper_8_plus": 4,
    }


def main():
    summaries = read_jsonl(SOURCE_SUMMARY)
    rows = read_jsonl(NORMALIZED)
    issue_stats = source_issue_stats(rows)

    candidates = []
    for summary in summaries:
        score_info = infer_band_from_scores(summary)
        summary["score_info"] = score_info
        bucket = band_bucket(score_info["overall"])
        if bucket == "unknown":
            continue
        if summary["row_count"] < 8:
            continue
        stats = issue_stats.get(summary["source_pdf"], {})
        candidate = {
            "source_pdf": summary["source_pdf"],
            "overall": score_info["overall"],
            "criteria_scores": score_info["criteria"],
            "band_bucket": bucket,
            "row_count": summary["row_count"],
            "critical_rows": stats.get("critical_rows", 0),
            "major_rows": stats.get("major_rows", 0),
            "criteria_covered_by_critical_comments": stats.get("criteria", {}),
            "top_issue_families": dict(Counter(stats.get("issues", {})).most_common(8)),
            "selection_score": round(quality_score(summary, issue_stats), 2),
        }
        candidates.append(candidate)

    selected = []
    selected_sources = set()
    for bucket, target in target_counts().items():
        pool = [item for item in candidates if item["band_bucket"] == bucket]
        pool.sort(key=lambda item: (-item["selection_score"], -item["critical_rows"], item["source_pdf"]))
        for item in pool[:target]:
            selected.append(item)
            selected_sources.add(item["source_pdf"])

    # If any bucket lacks enough sources, fill from the best remaining scored sources.
    desired_total = sum(target_counts().values())
    if len(selected) < desired_total:
        remaining = [item for item in candidates if item["source_pdf"] not in selected_sources]
        remaining.sort(key=lambda item: (-item["selection_score"], -item["critical_rows"], item["source_pdf"]))
        for item in remaining[: desired_total - len(selected)]:
            selected.append(item)
            selected_sources.add(item["source_pdf"])

    heldout = [item for item in candidates if item["source_pdf"] not in selected_sources]
    heldout.sort(key=lambda item: (item["band_bucket"], -item["selection_score"], item["source_pdf"]))
    selected.sort(key=lambda item: (item["band_bucket"], -item["selection_score"], item["source_pdf"]))

    output = {
        "selection_method": "score-bearing source PDFs, balanced by band bucket, prioritized by comment density and critical criteria coverage",
        "target_counts": target_counts(),
        "selected_count": len(selected),
        "heldout_count": len(heldout),
        "selected": selected,
    }
    OUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    HELDOUT_JSON.write_text(json.dumps({"heldout_count": len(heldout), "heldout": heldout}, ensure_ascii=False, indent=2))

    chunks = ["# Examiner Calibration Subset", ""]
    chunks.append("Selected source PDFs for the first prompt-calibration run.")
    chunks.append("")
    chunks.append(f"Selected: {len(selected)}")
    chunks.append(f"Held out: {len(heldout)}")
    chunks.append("")
    chunks.append("## Bucket Counts")
    chunks.append("")
    for bucket, count in Counter(item["band_bucket"] for item in selected).items():
        chunks.append(f"- {bucket}: {count}")
    chunks.append("")
    for bucket in target_counts():
        chunks.append(f"## {bucket}")
        chunks.append("")
        for item in [item for item in selected if item["band_bucket"] == bucket]:
            chunks.append(
                f"- `{item['overall']}` `{item['critical_rows']} critical` `{item['row_count']} rows` "
                f"{item['source_pdf']}"
            )
            if item["top_issue_families"]:
                issue_text = ", ".join(f"{key}:{value}" for key, value in item["top_issue_families"].items())
                chunks.append(f"  - issues: {issue_text}")
            if item["criteria_scores"]:
                score_text = ", ".join(f"{key}:{value}" for key, value in item["criteria_scores"].items())
                chunks.append(f"  - criteria scores: {score_text}")
        chunks.append("")
    OUT_MD.write_text("\n".join(chunks))

    print(
        json.dumps(
            {
                "selected": len(selected),
                "heldout": len(heldout),
                "bucket_counts": Counter(item["band_bucket"] for item in selected),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
