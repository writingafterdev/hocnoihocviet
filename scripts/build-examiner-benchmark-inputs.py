#!/usr/bin/env python3
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path.cwd()
CASES_PATH = ROOT / "tmp" / "marked-script-detailed-log" / "examiner-source-cases.json"
OUT_DIR = ROOT / "tmp" / "examiner-benchmark-inputs"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def norm(value: str) -> str:
    return re.sub(r"\W+", " ", value.lower()).strip()


def bucket_from_band(band):
    if band is None:
        return "unknown"
    band = float(band)
    if band < 6.25:
        return "low"
    if band < 7:
        return "mid"
    if band < 8:
        return "high"
    return "upper"


def group_words_into_lines(words):
    buckets = []
    for word in sorted(words, key=lambda w: (round(w["top"], 1), w["x0"])):
        placed = False
        for bucket in buckets:
            if abs(bucket["top"] - word["top"]) <= 2.6:
                bucket["words"].append(word)
                bucket["top"] = min(bucket["top"], word["top"])
                placed = True
                break
        if not placed:
            buckets.append({"top": word["top"], "words": [word]})

    lines = []
    for bucket in sorted(buckets, key=lambda b: b["top"]):
        words_sorted = sorted(bucket["words"], key=lambda w: w["x0"])
        text = clean(" ".join(w["text"] for w in words_sorted))
        if text:
            lines.append(text)
    return lines


def extract_main_text_from_pdf(pdf_path: Path):
    pages = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
            # Word/PDF margin comments are usually in the right rail. Keep the main
            # writing area only. This is intentionally conservative: the benchmark
            # essay should not include examiner margin comments.
            main_words = [word for word in words if word["x0"] < page.width * 0.68]
            pages.append(group_words_into_lines(main_words))
    return pages


NOISE_LINE_RE = re.compile(
    r"^\s*(Task achievement|Task response|Cohesion/Coherence|Coherence/Cohesion|Vocabulary|Lexical|Grammar|Overall|Band Score|TR|TA|CC|LR|GRA)\s*[:：]",
    re.I,
)


def strip_line_noise(lines):
    kept = []
    for line in lines:
        if not line:
            continue
        if NOISE_LINE_RE.search(line):
            continue
        if re.match(r"^\s*(Formatted|Deleted|Inserted):", line, re.I):
            continue
        line = re.sub(r"Comment\s+\[[^\]]+\]:.*", "", line).strip()
        line = re.sub(r"\bFormatted:\s*.*", "", line).strip()
        if line:
            kept.append(line)
    return kept


def line_norm_key(line):
    words = norm(line).split()
    return " ".join(words[:12])


def prompt_key(prompt):
    words = [word for word in norm(prompt).split() if len(word) > 1]
    return " ".join(words[:10])


def infer_prompt_from_text_path(text_path):
    if not text_path:
        return ""
    path = ROOT / text_path
    if not path.exists():
        return ""
    text = path.read_text(errors="ignore")
    text = re.sub(r"Formatted:\s*.*", " ", text, flags=re.I)
    text = re.sub(r"Comment\s+\[[^\]]+\]:[^\n]*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""

    head = text[:2400]
    markers = [
        r"Writing Task 2",
        r"WRITING TASK 2",
        r"Topic[-: ]",
        r"Question[-: ]",
        r"Task[-: ]",
    ]
    start = 0
    for marker in markers:
        match = re.search(marker, head, flags=re.I)
        if match:
            start = match.end()
            break

    search_area = head[start:]
    question_mark = re.search(r"[?？]", search_area)
    if not question_mark:
        return ""

    end = question_mark.end()
    candidate = search_area[:end]
    # Keep the prompt statement before the final question, but remove common
    # instruction boilerplate and visible score fragments.
    candidate = re.sub(r"You should spend about 40 minutes on this task\.?", " ", candidate, flags=re.I)
    candidate = re.sub(r"Write about \d+ words\.?", " ", candidate, flags=re.I)
    candidate = re.sub(r"\(\s*\d+(?:\.\d+)?\s*\)", " ", candidate)
    candidate = re.sub(r"^\s*[-–—:|]+", "", candidate)
    candidate = clean(candidate)

    # Some transcripts have score-table noise before the actual task. Trim to the
    # last plausible sentence opener while preserving the task question.
    words = candidate.split()
    if len(words) > 80:
        candidate = " ".join(words[-80:])
    return candidate


def find_prompt_line(lines, prompt):
    key = prompt_key(prompt)
    if not key:
        return -1
    for index, line in enumerate(lines):
        if key in norm(line):
            return index
    first_words = norm(prompt).split()[:6]
    if len(first_words) >= 4:
        fallback = " ".join(first_words)
        for index, line in enumerate(lines):
            if fallback in norm(line):
                return index
    return -1


def find_next_prompt_line(lines, start_index, sibling_prompts):
    siblings = [prompt for prompt in sibling_prompts if prompt]
    for index in range(start_index + 1, len(lines)):
        current = norm(lines[index])
        for prompt in siblings:
            if prompt_key(prompt) and prompt_key(prompt) in current:
                return index
    return len(lines)


def looks_like_end_line(line):
    if NOISE_LINE_RE.search(line):
        return True
    if re.search(r"\bOverall\s*[:：]\s*\d", line, re.I):
        return True
    return False


def extract_case_essay(case, sibling_prompts):
    pdf_path = ROOT / case["file"]
    pages = extract_main_text_from_pdf(pdf_path)
    all_lines = []
    for page in pages:
        all_lines.extend(page)
        all_lines.append("--- PAGE BREAK ---")
    all_lines = strip_line_noise(all_lines)

    prompt_index = find_prompt_line(all_lines, case.get("prompt", ""))
    if prompt_index < 0:
        return "", {
            "status": "failed",
            "reason": "prompt_not_found_in_pdf_text",
            "wordCount": 0,
            "artifactCount": 0,
        }

    end_index = find_next_prompt_line(all_lines, prompt_index, sibling_prompts)
    slice_lines = []
    for line in all_lines[prompt_index:end_index]:
        if line == "--- PAGE BREAK ---":
            continue
        if slice_lines and looks_like_end_line(line):
            break
        slice_lines.append(line)

    if slice_lines:
        first = slice_lines[0]
        prompt = case.get("prompt", "")
        # Remove the prompt if it is embedded at the beginning of the slice.
        key = prompt_key(prompt)
        if key and key in norm(first):
            first_clean = first
            # If the essay begins after a question mark, keep the text after the
            # final prompt question mark. Some prompts include two questions.
            if "?" in first_clean:
                first_clean = first_clean.split("?")[-1].strip()
            elif "？" in first_clean:
                first_clean = first_clean.split("？")[-1].strip()
            slice_lines[0] = first_clean

    essay = clean(" ".join(line for line in slice_lines if line))
    essay = re.sub(r"\bReal Past IELTS Exam/Test\b", "", essay, flags=re.I)
    essay = clean(essay)

    artifacts = estimate_artifacts(essay)
    words = re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)?", essay)
    status = "usable"
    reason = ""
    if len(words) < 120:
        status = "failed"
        reason = "essay_too_short_after_extraction"
    elif artifacts >= 18:
        status = "needs_manual_cleaning"
        reason = "too_many_track_change_artifacts"
    elif artifacts >= 8:
        status = "usable_with_warnings"
        reason = "track_change_artifacts_present"

    return essay, {
        "status": status,
        "reason": reason,
        "wordCount": len(words),
        "artifactCount": artifacts,
    }


ARTIFACT_PATTERNS = [
    r"\b\w{3,}(?:ing|ed|s|ly|al|ion|ity|ment)(?:can|could|would|should|is|are|was|were|to|from|of|in|at|with)\b",
    r"\b(?:can|could|would|should|is|are|was|were|have|has|had)[a-z]{3,}\b",
    r"\b[a-z]{3,}(?:can|could|would|should|is|are|was|were|have|has|had)[a-z]{3,}\b",
    r"\b\w+[a-z][A-Z]\w+\b",
    r"\b\w+(?:practical|accurate|better|clearer|specific|academic|formal)\w+\b",
]


def estimate_artifacts(text):
    count = 0
    for pattern in ARTIFACT_PATTERNS:
        count += len(re.findall(pattern, text))
    # Common visible track-change adjacency in the corpus: original + correction
    # appears without a space or appears as doubled alternatives.
    count += len(re.findall(r"\b(\w+)\s+\1\b", text, flags=re.I))
    return count


def build_inputs():
    cases = json.loads(CASES_PATH.read_text())
    by_file = defaultdict(list)
    for case in cases:
        by_file[case["file"]].append(case)

    rows = []
    for case in cases:
        band = case.get("score", {}).get("band")
        prompt = case.get("prompt") or infer_prompt_from_text_path(case.get("extractedTextPath"))
        if not prompt:
            continue
        case_for_extraction = dict(case)
        case_for_extraction["prompt"] = prompt
        essay, extraction = extract_case_essay(
            case_for_extraction,
            [item.get("prompt", "") for item in by_file[case["file"]] if item["caseId"] != case["caseId"]],
        )
        row = {
            "caseId": case["caseId"],
            "sourcePdf": case["file"],
            "heading": case.get("heading", ""),
            "bucket": bucket_from_band(band),
            "score": case.get("score", {}),
            "scores": {"overall": str(band)} if band is not None else {},
            "question": prompt,
            "essay": essay,
            "essayWordCount": extraction["wordCount"],
            "extraction": extraction,
            "examinerPriorities": case.get("examinerPriorities", []),
            "promptDesignLessons": case.get("promptDesignLessons", []),
            "rawCaseNote": case.get("rawCaseNote", ""),
        }
        rows.append(row)

    rows.sort(key=lambda row: (
        {"usable": 0, "usable_with_warnings": 1, "needs_manual_cleaning": 2, "failed": 3}.get(row["extraction"]["status"], 9),
        {"low": 0, "mid": 1, "high": 2, "upper": 3, "unknown": 4}.get(row["bucket"], 9),
        row["caseId"],
    ))
    return rows


def write_outputs(rows):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "examiner-benchmark-inputs.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + ("\n" if rows else "")
    )
    usable = [row for row in rows if row["extraction"]["status"] in {"usable", "usable_with_warnings"}]
    (OUT_DIR / "examiner-benchmark-inputs-usable.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in usable) + ("\n" if usable else "")
    )

    status_counts = Counter(row["extraction"]["status"] for row in rows)
    bucket_counts = Counter(row["bucket"] for row in rows)
    usable_bucket_counts = Counter(row["bucket"] for row in usable)
    summary = {
        "totalPromptScoreCases": len(rows),
        "usableCases": len(usable),
        "statusCounts": dict(status_counts),
        "bucketCounts": dict(bucket_counts),
        "usableBucketCounts": dict(usable_bucket_counts),
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))

    lines = [
        "# Examiner Benchmark Inputs",
        "",
        f"Total prompt+score cases: {len(rows)}",
        f"Usable or warning cases: {len(usable)}",
        "",
        "## Status Counts",
        "",
    ]
    for key, value in status_counts.items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Usable Bucket Counts", ""])
    for key, value in usable_bucket_counts.items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Cases", ""])
    for row in rows:
        lines.append(
            f"- `{row['caseId']}` `{row['bucket']}` score `{row['score'].get('band')}` "
            f"`{row['extraction']['status']}` words `{row['essayWordCount']}` artifacts `{row['extraction']['artifactCount']}` "
            f"{row['heading']} — {row['sourcePdf']}"
        )
        if row["extraction"].get("reason"):
            lines.append(f"  - reason: {row['extraction']['reason']}")
    (OUT_DIR / "summary.md").write_text("\n".join(lines))
    return summary


def main():
    rows = build_inputs()
    summary = write_outputs(rows)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
