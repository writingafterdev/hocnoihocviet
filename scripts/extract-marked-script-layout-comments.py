#!/usr/bin/env python3
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path.cwd()
MARKED_DIR = ROOT / "marked script"
OUT_DIR = ROOT / "tmp" / "marked-script-comment-corpus"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def load_manifest_rows():
    manifest_rows = []
    for manifest in sorted((ROOT / "tmp").glob("marked-script-vision-batch-*/batch-manifest.json")):
        batch = manifest.parent.name
        data = json.loads(manifest.read_text())
        for item in data:
            if "file" in item:
                pdf_path = Path(item["file"])
            else:
                pdf_path = MARKED_DIR / item["name"]
            manifest_rows.append(
                {
                    "batch": batch,
                    "name": pdf_path.name,
                    "pdf_path": pdf_path,
                    "render_dir": item.get("dir"),
                    "pages_rendered": item.get("pages"),
                }
            )

    # Some later batches only have rendered/extracted folders and no manifest.
    # The source of truth for this pass is the actual marked-script PDF folder.
    # Use manifest metadata where available, but never let a manifest schema
    # mismatch exclude a source PDF.
    by_name = {row["pdf_path"].name: row for row in manifest_rows}
    rows = []
    for pdf_path in sorted(MARKED_DIR.glob("*.pdf")):
        row = by_name.get(pdf_path.name)
        if row:
            rows.append(row)
        else:
            rows.append(
                {
                    "batch": "unmanifested",
                    "name": pdf_path.name,
                    "pdf_path": pdf_path,
                    "render_dir": None,
                    "pages_rendered": None,
                }
            )
    return rows


def group_lines(words):
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
    for bucket in buckets:
        words_sorted = sorted(bucket["words"], key=lambda w: w["x0"])
        text = " ".join(w["text"] for w in words_sorted)
        lines.append(
            {
                "top": bucket["top"],
                "x0": min(w["x0"] for w in words_sorted),
                "x1": max(w["x1"] for w in words_sorted),
                "text": clean(text),
            }
        )
    return sorted(lines, key=lambda line: (line["top"], line["x0"]))


COMMENT_START_RE = re.compile(r"(Comment\s+\[([^\]]+)\]:|Formatted:|Deleted:|Inserted:)\s*")


def extract_margin_comments(pdf_path: Path, batch: str):
    records = []
    page_count = 0
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            page_count = len(pdf.pages)
            for page_index, page in enumerate(pdf.pages, start=1):
                words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
                # Most Dave/Word comments live in the right margin. Use a generous
                # threshold so comments on slightly different templates are kept.
                right_words = [w for w in words if w["x0"] >= page.width * 0.68]
                lines = group_lines(right_words)
                page_text_parts = []
                marker_hits = []
                cursor = 0
                for line in lines:
                    text = line["text"]
                    if not text:
                        continue
                    for match in COMMENT_START_RE.finditer(text):
                        marker_hits.append(
                            {
                                "start": cursor + match.start(),
                                "end": cursor + match.end(),
                                "kind": match.group(1).split(":", 1)[0],
                                "comment_id": match.group(2),
                                "top": round(line["top"], 2),
                            }
                        )
                    page_text_parts.append(text)
                    cursor += len(text) + 1

                if not marker_hits:
                    continue

                page_text = "\n".join(page_text_parts)
                for index, marker in enumerate(marker_hits):
                    next_start = marker_hits[index + 1]["start"] if index + 1 < len(marker_hits) else len(page_text)
                    body = clean(page_text[marker["end"]:next_start])
                    if marker["comment_id"]:
                        body = re.sub(rf"^{re.escape(marker['comment_id'])}\s*:\s*", "", body)
                    if not body:
                        continue
                    kind = "Comment" if marker["kind"].startswith("Comment") else marker["kind"]
                    records.append(
                        {
                            "source_pdf": str(pdf_path.relative_to(ROOT)),
                            "batch": batch,
                            "page": page_index,
                            "extraction_type": "layout_margin_comment",
                            "comment_id": marker["comment_id"],
                            "kind": kind,
                            "top": marker["top"],
                            "text": body,
                        }
                    )
    except Exception as exc:
        return [], {"source_pdf": str(pdf_path.relative_to(ROOT)), "batch": batch, "error": str(exc)}
    return records, {"source_pdf": str(pdf_path.relative_to(ROOT)), "batch": batch, "pages": page_count, "layout_margin_comments": len(records)}


def write_jsonl(path: Path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + ("\n" if rows else ""))


def write_markdown(path: Path, records):
    grouped = {}
    for record in records:
        grouped.setdefault(record["source_pdf"], []).append(record)
    chunks = ["# Layout Extracted Literal Margin Comments", ""]
    for source in sorted(grouped):
        chunks.append(f"## {source}")
        chunks.append("")
        for item in sorted(grouped[source], key=lambda r: (r["page"], r["top"], r.get("comment_id") or "")):
            cid = f" {item['comment_id']}" if item.get("comment_id") else ""
            chunks.append(f"- p.{item['page']} {item['kind']}{cid}: {item['text']}")
        chunks.append("")
    path.write_text("\n".join(chunks))


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = load_manifest_rows()
    records = []
    coverage = []
    errors = []
    for row in rows:
        pdf_path = row["pdf_path"]
        if not pdf_path.exists():
            errors.append({"source_pdf": str(pdf_path.relative_to(ROOT)), "batch": row["batch"], "error": "missing_pdf"})
            continue
        extracted, cov = extract_margin_comments(pdf_path, row["batch"])
        records.extend(extracted)
        if "error" in cov:
            errors.append(cov)
        else:
            coverage.append(cov)

    write_jsonl(OUT_DIR / "layout-margin-comments.jsonl", records)
    write_jsonl(OUT_DIR / "layout-margin-coverage.jsonl", coverage)
    write_jsonl(OUT_DIR / "layout-margin-errors.jsonl", errors)
    write_jsonl(
        OUT_DIR / "layout-margin-needs-review.jsonl",
        [row for row in coverage if row["layout_margin_comments"] == 0],
    )
    write_markdown(OUT_DIR / "layout-margin-comments.md", records)
    print(
        json.dumps(
            {
                "pdfs_scanned": len(rows),
                "layout_margin_comments": len(records),
                "zero_layout_comment_pdfs": sum(1 for row in coverage if row["layout_margin_comments"] == 0),
                "errors": len(errors),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
