import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "tmp", "marked-script-comment-corpus");
const TEXT_GLOB_ROOT = path.join(ROOT, "tmp");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rel(file) {
  return path.relative(ROOT, file);
}

function normalizeText(value) {
  return value
    .replace(/\u000c/g, "\n<<<PAGE_BREAK>>>\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\r\n/g, "\n");
}

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sourceIdFromTextFile(file) {
  const parts = rel(file).split(path.sep);
  const batch = parts.find((p) => /^marked-script-vision-batch-\d+$/.test(p)) ?? "unknown-batch";
  const base = path.basename(file, ".txt");
  return `${batch}/${base}`;
}

function maybeContinuation(line) {
  if (!line.trim()) return false;
  if (line.includes("Comment [")) return false;
  if (line.trim() === "<<<PAGE_BREAK>>>") return false;
  // pdftotext keeps the right margin comments deeply indented in Dave-style PDFs.
  return /^\s{28,}\S/.test(line);
}

function extractDaveComments(lines, sourceId) {
  const comments = [];
  let current = null;
  let page = 1;

  const flush = () => {
    if (!current) return;
    current.text = clean(current.parts.join(" "));
    delete current.parts;
    if (current.text) comments.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "<<<PAGE_BREAK>>>") {
      flush();
      page += 1;
      continue;
    }

    const match = line.match(/Comment\s+\[([^\]]+)\]:\s*(.*)$/);
    if (match) {
      flush();
      current = {
        source_id: sourceId,
        extraction_type: "comment_box",
        comment_id: match[1],
        page,
        line: i + 1,
        parts: [match[2]],
      };
      continue;
    }

    if (current && maybeContinuation(line)) {
      current.parts.push(line.trim());
      continue;
    }

    // Any normal body line ends the previous right-margin comment.
    if (current && line.trim()) flush();
  }
  flush();
  return comments;
}

function extractBracketComments(text, sourceId) {
  const comments = [];
  const regex = /\[([^\[\]\n]{8,700})\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(0, match.index);
    const page = before.split("<<<PAGE_BREAK>>>").length;
    const line = before.split("\n").length;
    const value = clean(match[1]);
    if (!value) continue;
    if (/^https?:\/\//i.test(value)) continue;
    comments.push({
      source_id: sourceId,
      extraction_type: "inline_bracket",
      comment_id: null,
      page,
      line,
      text: value,
    });
  }
  return comments;
}

function extractAdviceBlocks(lines, sourceId) {
  const comments = [];
  const starts = [
    /^To improve:/i,
    /^Overall\s*:?/i,
    /^Final diagnosis/i,
    /^Final advice/i,
    /^Prompt implication/i,
  ];
  let page = 1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "<<<PAGE_BREAK>>>") {
      page += 1;
      continue;
    }
    if (!starts.some((pattern) => pattern.test(line.trim()))) continue;
    const block = [line.trim()];
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      const next = lines[j];
      if (next.trim() === "<<<PAGE_BREAK>>>") break;
      if (/^Comment\s+\[/.test(next.trim())) break;
      if (/^\s*$/.test(next)) {
        if (block.length > 1) break;
        continue;
      }
      block.push(next.trim());
    }
    comments.push({
      source_id: sourceId,
      extraction_type: "advice_block",
      comment_id: null,
      page,
      line: i + 1,
      text: clean(block.join(" ")),
    });
  }
  return comments;
}

function extractRubricLines(lines, sourceId) {
  const comments = [];
  let page = 1;
  const patterns = [
    /Task\s*(Response|achievement)\s*:?\s*\d/i,
    /Cohesion\s*(and|\/)?\s*Coherence\s*:?\s*\d/i,
    /Vocabulary\s*:?\s*\d/i,
    /Grammar\s*:?\s*\d/i,
    /Overall\s*:?\s*\d/i,
    /^[✓✔x✘]\s*/i,
  ];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "<<<PAGE_BREAK>>>") {
      page += 1;
      continue;
    }
    const value = clean(line);
    if (value.length < 12) continue;
    if (!patterns.some((pattern) => pattern.test(value))) continue;
    comments.push({
      source_id: sourceId,
      extraction_type: "rubric_line",
      comment_id: null,
      page,
      line: i + 1,
      text: value,
    });
  }
  return comments;
}

function toMarkdownBySource(comments) {
  const bySource = new Map();
  for (const comment of comments) {
    if (!bySource.has(comment.source_id)) bySource.set(comment.source_id, []);
    bySource.get(comment.source_id).push(comment);
  }

  const chunks = ["# Marked Script Literal Comment Candidates", ""];
  for (const [sourceId, items] of [...bySource.entries()].sort()) {
    chunks.push(`## ${sourceId}`, "");
    for (const item of items) {
      const label = item.comment_id ? `${item.extraction_type} ${item.comment_id}` : item.extraction_type;
      chunks.push(`- p.${item.page} l.${item.line} ${label}: ${item.text}`);
    }
    chunks.push("");
  }
  return chunks.join("\n");
}

function main() {
  ensureDir(OUT_DIR);
  const textFiles = walk(TEXT_GLOB_ROOT)
    .filter((file) => /marked-script-vision-batch-\d+/.test(file))
    .filter((file) => file.includes(`${path.sep}extracted-text${path.sep}`))
    .filter((file) => file.endsWith(".txt"))
    .sort();

  const all = [];
  const perFile = [];
  for (const file of textFiles) {
    const sourceId = sourceIdFromTextFile(file);
    const raw = normalizeText(fs.readFileSync(file, "utf8"));
    const lines = raw.split("\n");
    const comments = [
      ...extractDaveComments(lines, sourceId),
      ...extractBracketComments(raw, sourceId),
      ...extractAdviceBlocks(lines, sourceId),
      ...extractRubricLines(lines, sourceId),
    ];
    for (const comment of comments) {
      comment.text_file = rel(file);
      all.push(comment);
    }
    perFile.push({
      source_id: sourceId,
      text_file: rel(file),
      comment_candidates: comments.length,
      comment_boxes: comments.filter((c) => c.extraction_type === "comment_box").length,
      inline_brackets: comments.filter((c) => c.extraction_type === "inline_bracket").length,
      advice_blocks: comments.filter((c) => c.extraction_type === "advice_block").length,
      rubric_lines: comments.filter((c) => c.extraction_type === "rubric_line").length,
    });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "comment-candidates.jsonl"),
    all.map((item) => JSON.stringify(item)).join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "comment-candidates.md"),
    toMarkdownBySource(all),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "source-coverage.jsonl"),
    perFile.map((item) => JSON.stringify(item)).join("\n") + "\n",
  );

  const weak = perFile
    .filter((item) => item.comment_candidates < 5)
    .sort((a, b) => a.comment_candidates - b.comment_candidates);
  fs.writeFileSync(
    path.join(OUT_DIR, "needs-vision-review.jsonl"),
    weak.map((item) => JSON.stringify(item)).join("\n") + (weak.length ? "\n" : ""),
  );

  const summary = [
    "# Marked Script Comment Corpus",
    "",
    `Text files scanned: ${textFiles.length}`,
    `Comment candidates extracted: ${all.length}`,
    `Sources with fewer than 5 candidates: ${weak.length}`,
    "",
    "Outputs:",
    "",
    "- `comment-candidates.jsonl`: raw candidate comments, one row per candidate.",
    "- `comment-candidates.md`: readable grouped view.",
    "- `source-coverage.jsonl`: counts per source.",
    "- `needs-vision-review.jsonl`: sources likely needing manual vision transcription.",
    "",
    "Important: this is the first literal-candidate pass. It must be followed by vision QA for sources with weak extraction and normalization into final examiner-comment rows.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), summary);
  console.log(summary);
}

main();
