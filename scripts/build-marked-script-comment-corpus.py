#!/usr/bin/env python3
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path.cwd()
OUT_DIR = ROOT / "tmp" / "marked-script-comment-corpus"
MARKED_DIR = ROOT / "marked script"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return value


def read_jsonl(path: Path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write_jsonl(path: Path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + ("\n" if rows else ""))


def pdf_lookup():
    mapping = {}
    for pdf in sorted(MARKED_DIR.glob("*.pdf")):
        mapping[slug(pdf.stem)] = str(pdf.relative_to(ROOT))
    for manifest in sorted((ROOT / "tmp").glob("marked-script-vision-batch-*/batch-manifest.json")):
        data = json.loads(manifest.read_text())
        for item in data:
            source = item.get("file") or item.get("name")
            directory = item.get("dir")
            if source:
                pdf = Path(source)
                mapping[slug(pdf.stem)] = str((MARKED_DIR / pdf.name).relative_to(ROOT))
            if source and directory:
                directory_slug = slug(Path(directory).name)
                pdf_source = str((MARKED_DIR / Path(source).name).relative_to(ROOT))
                mapping[directory_slug] = pdf_source
                mapping[re.sub(r"^\d+_", "", directory_slug)] = pdf_source
    return mapping


def source_from_candidate(row, lookup):
    text_file = row.get("text_file")
    if text_file:
        stem = Path(text_file).stem
        keys = [slug(stem), slug(re.sub(r"^\d+_", "", stem))]
        for key in keys:
            if key in lookup:
                return lookup[key]
    source_id = row.get("source_id", "")
    if "/" in source_id:
        key = slug(source_id.split("/", 1)[1])
        if key in lookup:
            return lookup[key]
    return source_id or "unknown"


def normalize_layout(row):
    return {
        "source_pdf": row["source_pdf"],
        "page": row.get("page"),
        "source_kind": "word_margin_comment",
        "comment_id": row.get("comment_id"),
        "comment_type": row.get("kind", "Comment"),
        "text": clean(row.get("text", "")),
        "raw": row,
    }


def normalize_ocr(row):
    return {
        "source_pdf": row["source_pdf"],
        "page": row.get("page"),
        "source_kind": "ocr_margin_comment",
        "comment_id": row.get("comment_id"),
        "comment_type": row.get("kind", "Commented"),
        "text": clean(row.get("text", "")),
        "raw": row,
    }


def normalize_candidate(row, lookup):
    return {
        "source_pdf": source_from_candidate(row, lookup),
        "page": row.get("page"),
        "source_kind": row.get("extraction_type"),
        "comment_id": row.get("comment_id"),
        "comment_type": row.get("extraction_type"),
        "text": clean(row.get("text", "")),
        "raw": row,
    }


def write_markdown(path: Path, rows):
    grouped = {}
    for row in rows:
        grouped.setdefault(row["source_pdf"], []).append(row)
    chunks = ["# Final Marked-Script Comment Corpus", ""]
    chunks.append("This file combines layout-extracted Word margin comments, OCR-extracted screenshot comments, and non-margin inline/rubric/advice notes.")
    chunks.append("")
    for source in sorted(grouped):
        chunks.append(f"## {source}")
        chunks.append("")
        for index, row in enumerate(sorted(grouped[source], key=lambda r: (r.get("page") or 0, r["source_kind"], r.get("comment_id") or "", r["text"])), start=1):
            page = f"p.{row['page']}" if row.get("page") else "p.?"
            cid = f" {row['comment_id']}" if row.get("comment_id") else ""
            chunks.append(f"{index}. `{page}` `{row['source_kind']}`{cid}: {row['text']}")
        chunks.append("")
    path.write_text("\n".join(chunks))


def main():
    lookup = pdf_lookup()
    rows = []
    rows.extend(normalize_layout(row) for row in read_jsonl(OUT_DIR / "layout-margin-comments.jsonl"))
    rows.extend(normalize_ocr(row) for row in read_jsonl(OUT_DIR / "ocr-margin-comments.jsonl"))

    # Keep only non-margin candidates from the text extractor. `comment_box`
    # candidates are intentionally skipped because they are truncated versions
    # of the same Word comments already recovered by the layout pass.
    for row in read_jsonl(OUT_DIR / "comment-candidates.jsonl"):
        if row.get("extraction_type") == "comment_box":
            continue
        if "Comment [" in row.get("text", "") or "Commented [" in row.get("text", ""):
            continue
        rows.append(normalize_candidate(row, lookup))

    seen = set()
    unique = []
    for row in rows:
        key = (row["source_pdf"], row.get("page"), row["source_kind"], row.get("comment_id"), row["text"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    unique.sort(key=lambda r: (r["source_pdf"], r.get("page") or 0, r["source_kind"], r.get("comment_id") or "", r["text"]))
    write_jsonl(OUT_DIR / "final-comment-rows.jsonl", unique)
    write_markdown(OUT_DIR / "final-comment-rows.md", unique)

    by_source = {}
    for row in unique:
        by_source.setdefault(row["source_pdf"], 0)
        by_source[row["source_pdf"]] += 1
    coverage = [{"source_pdf": source, "final_comment_rows": count} for source, count in sorted(by_source.items())]
    write_jsonl(OUT_DIR / "final-comment-coverage.jsonl", coverage)

    all_pdfs = {str(path.relative_to(ROOT)) for path in MARKED_DIR.glob("*.pdf")}
    covered = set(by_source)
    write_jsonl(
        OUT_DIR / "final-comment-needs-review.jsonl",
        [{"source_pdf": source, "reason": "no comment rows extracted"} for source in sorted(all_pdfs - covered)],
    )

    print(
        json.dumps(
            {
                "final_comment_rows": len(unique),
                "sources_with_rows": len(by_source),
                "pdfs_without_rows": len(all_pdfs - covered),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
