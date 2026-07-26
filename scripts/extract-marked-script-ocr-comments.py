#!/usr/bin/env python3
import json
import re
import unicodedata
from pathlib import Path

from ocrmac import ocrmac

ROOT = Path.cwd()
OUT_DIR = ROOT / "tmp" / "marked-script-comment-corpus"

COMMENT_START_RE = re.compile(r"(Commented\s+[\[\(]([^\]\)]+)[\]\)]:|Comment\s+[\[\(]([^\]\)]+)[\]\)]:)\s*")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return value


def load_zero_layout_sources():
    path = OUT_DIR / "layout-margin-needs-review.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def render_dirs_by_slug():
    mapping = {}
    for manifest in sorted((ROOT / "tmp").glob("marked-script-vision-batch-*/batch-manifest.json")):
        data = json.loads(manifest.read_text())
        for item in data:
            source = item.get("file") or item.get("name")
            directory = item.get("dir")
            if not source or not directory:
                continue
            directory_path = Path(directory)
            if not directory_path.exists():
                continue
            mapping[f"path:{Path(source).name}"] = directory_path
    for directory in sorted((ROOT / "tmp").glob("marked-script-vision-batch-*/*")):
        if not directory.is_dir() or not (directory / "contact-sheet.png").exists():
            continue
        mapping[slug(directory.name)] = directory
    return mapping


def find_render_dir(source_pdf: str, directories):
    by_name = directories.get(f"path:{Path(source_pdf).name}")
    if by_name:
        return by_name
    stem_slug = slug(Path(source_pdf).stem)
    if stem_slug in directories:
        return directories[stem_slug]
    for key, directory in directories.items():
        if stem_slug in key or key in stem_slug:
            return directory
    return None


def ocr_page_lines(image_path: Path):
    result = ocrmac.OCR(
        str(image_path),
        recognition_level="accurate",
        language_preference=["en-US"],
        confidence_threshold=0.0,
        detail=True,
    ).recognize()
    lines = []
    for text, confidence, box in result:
        x, y, width, height = box
        text = clean(text)
        if not text:
            continue
        lines.append(
            {
                "text": text,
                "confidence": float(confidence),
                "x": float(x),
                "y": float(y),
                "width": float(width),
                "height": float(height),
            }
        )
    return sorted(lines, key=lambda item: (-item["y"], item["x"]))


def parse_comment_lines(lines):
    right_lines = [line for line in lines if line["x"] >= 0.62]
    text_parts = []
    markers = []
    cursor = 0
    for line in right_lines:
        text = line["text"]
        for match in COMMENT_START_RE.finditer(text):
            markers.append(
                {
                    "start": cursor + match.start(),
                    "end": cursor + match.end(),
                    "kind": "Commented" if match.group(1).startswith("Commented") else "Comment",
                    "comment_id": match.group(2) or match.group(3),
                    "y": round(line["y"], 4),
                    "x": round(line["x"], 4),
                    "confidence": round(line["confidence"], 4),
                }
            )
        text_parts.append(text)
        cursor += len(text) + 1

    page_text = "\n".join(text_parts)
    comments = []
    for index, marker in enumerate(markers):
        next_start = markers[index + 1]["start"] if index + 1 < len(markers) else len(page_text)
        body = clean(page_text[marker["end"]:next_start])
        if marker["comment_id"]:
            body = re.sub(rf"^{re.escape(marker['comment_id'])}\s*:\s*", "", body)
        if body:
            item = dict(marker)
            item["text"] = body
            comments.append(item)
    return comments


def write_jsonl(path: Path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + ("\n" if rows else ""))


def write_markdown(path: Path, records):
    grouped = {}
    for record in records:
        grouped.setdefault(record["source_pdf"], []).append(record)
    chunks = ["# OCR Extracted Image-PDF Comments", ""]
    for source in sorted(grouped):
        chunks.append(f"## {source}")
        chunks.append("")
        for item in sorted(grouped[source], key=lambda r: (r["page"], -r["y"], r.get("comment_id") or "")):
            chunks.append(f"- p.{item['page']} {item['kind']} {item['comment_id']}: {item['text']}")
        chunks.append("")
    path.write_text("\n".join(chunks))


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    zero_sources = load_zero_layout_sources()
    directories = render_dirs_by_slug()
    records = []
    coverage = []
    errors = []

    for source in zero_sources:
        source_pdf = source["source_pdf"]
        render_dir = find_render_dir(source_pdf, directories)
        if not render_dir:
            errors.append({"source_pdf": source_pdf, "error": "missing_render_dir"})
            continue

        source_count = 0
        page_images = sorted(render_dir.glob("page-*.png"))
        for page_index, image_path in enumerate(page_images, start=1):
            try:
                lines = ocr_page_lines(image_path)
                comments = parse_comment_lines(lines)
            except Exception as exc:
                errors.append({"source_pdf": source_pdf, "page": page_index, "error": str(exc)})
                continue
            for comment in comments:
                comment.update(
                    {
                        "source_pdf": source_pdf,
                        "page": page_index,
                        "extraction_type": "ocr_margin_comment",
                        "image_path": str(image_path),
                    }
                )
                records.append(comment)
                source_count += 1
        coverage.append(
            {
                "source_pdf": source_pdf,
                "render_dir": str(render_dir),
                "pages": len(page_images),
                "ocr_margin_comments": source_count,
            }
        )

    write_jsonl(OUT_DIR / "ocr-margin-comments.jsonl", records)
    write_jsonl(OUT_DIR / "ocr-margin-coverage.jsonl", coverage)
    write_jsonl(OUT_DIR / "ocr-margin-errors.jsonl", errors)
    write_jsonl(
        OUT_DIR / "ocr-margin-needs-review.jsonl",
        [row for row in coverage if row["ocr_margin_comments"] == 0],
    )
    write_markdown(OUT_DIR / "ocr-margin-comments.md", records)
    print(
        json.dumps(
            {
                "image_pdfs_scanned": len(zero_sources),
                "ocr_margin_comments": len(records),
                "zero_ocr_comment_pdfs": sum(1 for row in coverage if row["ocr_margin_comments"] == 0),
                "errors": len(errors),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
