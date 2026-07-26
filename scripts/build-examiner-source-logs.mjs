import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, "tmp", "marked-script-audit");
const OUT_DIR = path.join(ROOT, "tmp", "marked-script-detailed-log");
const CANONICAL_JSONL = path.join(AUDIT_DIR, "canonical-source-bank.jsonl");

function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function normaliseName(value) {
  return path
    .basename(value || "", path.extname(value || ""))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function sectionAfterHeading(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return "";
  const bodyStart = start + heading.length;
  const next = markdown.slice(bodyStart).search(/\n## /);
  return next === -1 ? markdown.slice(bodyStart) : markdown.slice(bodyStart, bodyStart + next);
}

function parseFileInventory(markdown, batchId) {
  const section = sectionAfterHeading(markdown, "## File-Level Inventory");
  if (!section) return [];

  const rows = section
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line.trim()))
    .filter((line) => !/^\|\s*-+/.test(line.trim()));

  if (rows.length < 2) return [];

  const headers = splitTableRow(rows[0]).map((header) => header.toLowerCase());
  return rows.slice(1).map((line) => {
    const cells = splitTableRow(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] || "").replace(/^`|`$/g, "");
    });

    const file = record.file || record.pdf || "";
    return {
      batchId,
      file,
      normalisedFile: normaliseName(file),
      pages: record.pages || "",
      type: record.type || "",
      scoreSignal: record["score seen"] || record["score signal"] || "",
      sourceBankUse: record.use || record["main value for source bank"] || "",
      rawInventoryRow: line,
    };
  });
}

function takeUntilNextHeading(markdown, startIndex) {
  const body = markdown.slice(startIndex);
  const next = body.slice(1).search(/\n### /);
  return next === -1 ? body : body.slice(0, next + 1);
}

function parseCaseSections(markdown, batchId) {
  const sections = [];
  const ranges = [
    ["## Case-Level Notes", ["\n## Source-Bank", "\n## Cross-", "\n## Prompt", "\n## Recommended", "\n## Batch-Level"]],
    ["## High-Value Case Notes", ["\n## Source-Bank", "\n## Cross-", "\n## Prompt", "\n## Recommended", "\n## Batch-Level"]],
  ];

  for (const [heading, endMarkers] of ranges) {
    const start = markdown.indexOf(heading);
    if (start === -1) continue;

    let end = markdown.length;
    for (const marker of endMarkers) {
      const markerIndex = markdown.indexOf(marker, start + heading.length);
      if (markerIndex !== -1 && markerIndex < end) end = markerIndex;
    }

    const area = markdown.slice(start + heading.length, end);
    const headingMatches = [...area.matchAll(/^###\s+(.+)$/gm)];
    for (let index = 0; index < headingMatches.length; index += 1) {
      const match = headingMatches[index];
      const nextMatch = headingMatches[index + 1];
      const sectionStart = match.index;
      const sectionEnd = nextMatch ? nextMatch.index : area.length;
      const section = area.slice(sectionStart, sectionEnd).trim();
      if (section) sections.push(parseCaseSection(section, batchId, heading));
    }
  }

  return sections;
}

function parseCaseSection(section, batchId, groupHeading) {
  const heading = (section.match(/^###\s+(.+)$/m) || [])[1] || "Untitled case";
  const sourceFile =
    (section.match(/Source file:\s*`([^`]+)`/i) || [])[1] ||
    (heading.match(/`([^`]+)`/) || [])[1] ||
    "";
  const prompt = cleanInline((section.match(/Prompt:\s*([^\n]+)/i) || [])[1] || "");
  const score =
    cleanInline((section.match(/Score:\s*([^\n]+)/i) || [])[1] || "") ||
    cleanInline((heading.match(/Overall\s+(.+)$/i) || [])[1] || "");
  const pageRange =
    cleanInline((section.match(/Source file:[^\n]*,\s*pages?\s*([^.\n]+)/i) || [])[1] || "") ||
    cleanInline((section.match(/pages?\s+([0-9A-Za-z,\-\s]+)\./i) || [])[1] || "");

  return {
    batchId,
    detailLevel: groupHeading.includes("High-Value") ? "high_value_case_note" : "case_note",
    heading,
    sourceFile,
    normalisedFile: normaliseName(sourceFile),
    pageRange,
    prompt,
    scoreSignal: score,
    examinerPriorities: extractList(section, [
      "Examiner priorities",
      "The examiner gives",
      "The core lesson",
      "Core examiner signals",
      "The useful signal",
      "Key examiner signal",
    ]),
    promptDesignLessons: extractList(section, [
      "Prompt-design lesson",
      "Prompt-design lessons",
      "Prompt implication",
      "Prompt implications",
    ]),
    taxonomyUpdates: extractList(section, ["Useful taxonomy update", "Useful taxonomy updates"]),
    rawCaseNote: section,
  };
}

function extractList(section, labels) {
  const items = [];

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escaped}:?\\s*$`, "gim");
    for (const match of section.matchAll(regex)) {
      const after = section.slice(match.index + match[0].length);
      const lines = after.split(/\r?\n/);
      for (const line of lines) {
        if (/^#{1,6}\s+/.test(line)) break;
        if (/^\s*$/.test(line)) {
          if (items.length) break;
          continue;
        }
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
          items.push(cleanInline(bullet[1]));
          continue;
        }
        const quote = line.match(/^\s*>\s+(.+)$/);
        if (quote) {
          items.push(cleanInline(quote[1]));
          continue;
        }
        if (/^\s*[A-Z][A-Za-z /-]+:\s*$/.test(line)) break;
        if (items.length) break;
      }
    }
  }

  return [...new Set(items.filter(Boolean))];
}

function cleanInline(value) {
  return (value || "")
    .replace(/^`|`$/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function discoverBatchAudits() {
  const tmpDir = path.join(ROOT, "tmp");
  return fs
    .readdirSync(tmpDir)
    .filter((name) => /^marked-script-vision-batch-\d+$/.test(name))
    .map((name) => path.join(tmpDir, name, `${name.replace("marked-script-vision-", "")}-source-audit.md`))
    .filter((file) => fs.existsSync(file))
    .sort();
}

function findExtractedTextPath(batchId, normalisedFile) {
  const textDir = path.join(ROOT, "tmp", `marked-script-vision-${batchId}`, "extracted-text");
  if (!fs.existsSync(textDir)) return "";
  const match = fs
    .readdirSync(textDir)
    .find((file) => normaliseName(file) === normalisedFile);
  return match ? path.relative(ROOT, path.join(textDir, match)) : "";
}

function findContactSheetPath(batchId, normalisedFile) {
  const batchDir = path.join(ROOT, "tmp", `marked-script-vision-${batchId}`);
  if (!fs.existsSync(batchDir)) return "";
  const match = fs
    .readdirSync(batchDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .find((entry) => normaliseName(entry.name) === normalisedFile);
  if (!match) return "";
  const contact = path.join(batchDir, match.name, "contact-sheet.png");
  return fs.existsSync(contact) ? path.relative(ROOT, contact) : "";
}

function parseBand(scoreSignal, canonical) {
  const candidates = [scoreSignal, canonical?.scoreFromText, canonical?.scoreFromFilename]
    .filter(Boolean)
    .join(" ");
  const matches = [...candidates.matchAll(/\b([4-9](?:\.5)?)\b/g)].map((match) => Number(match[1]));
  if (!matches.length) return null;
  return matches.find((value) => value >= 4 && value <= 9) ?? null;
}

function bandBucket(band) {
  if (band == null) return "unknown";
  if (band < 6.5) return "low";
  if (band < 7.5) return "mid";
  return "high";
}

function main() {
  const canonicalRows = readJsonl(CANONICAL_JSONL).filter((row) => row.canonical === "yes");
  const canonicalByNorm = new Map(canonicalRows.map((row) => [normaliseName(row.file), row]));

  const inventoryByNorm = new Map();
  const caseNotes = [];
  const batchAudits = discoverBatchAudits();

  for (const auditFile of batchAudits) {
    const batchId = path.basename(auditFile).match(/batch-\d+/)?.[0] || "batch-unknown";
    const markdown = fs.readFileSync(auditFile, "utf8");
    for (const inventory of parseFileInventory(markdown, batchId)) {
      if (!inventory.file) continue;
      if (!inventoryByNorm.has(inventory.normalisedFile)) inventoryByNorm.set(inventory.normalisedFile, []);
      inventoryByNorm.get(inventory.normalisedFile).push(inventory);
    }
    caseNotes.push(...parseCaseSections(markdown, batchId));
  }

  const caseNotesByNorm = new Map();
  for (const note of caseNotes) {
    if (!note.normalisedFile) continue;
    if (!caseNotesByNorm.has(note.normalisedFile)) caseNotesByNorm.set(note.normalisedFile, []);
    caseNotesByNorm.get(note.normalisedFile).push(note);
  }

  const pdfLogs = canonicalRows.map((canonical) => {
    const normalisedFile = normaliseName(canonical.file);
    const inventory = inventoryByNorm.get(normalisedFile) || [];
    const notes = caseNotesByNorm.get(normalisedFile) || [];
    const primaryInventory = inventory[0] || {};
    const batchId = primaryInventory.batchId || notes[0]?.batchId || "";
    const band = parseBand(primaryInventory.scoreSignal || notes[0]?.scoreSignal || "", canonical);
    const detailLevel = notes.length ? "case_notes_available" : inventory.length ? "file_inventory_only" : "canonical_inventory_only";

    return {
      sourceId: canonical.sourceId,
      file: canonical.file,
      normalisedFile,
      canonicalPdfPages: Number(canonical.pages),
      canonicalWordCount: Number(canonical.words),
      canonicalCommentMarkers: Number(canonical.commentMarkers),
      score: {
        band,
        bucket: bandBucket(band),
        status: canonical.scoreStatus,
        fromFilename: canonical.scoreFromFilename || null,
        fromText: canonical.scoreFromText || null,
        visualSignal: primaryInventory.scoreSignal || notes[0]?.scoreSignal || null,
      },
      sourceType: primaryInventory.type || null,
      sourceBankUse: primaryInventory.sourceBankUse || null,
      batchId,
      detailLevel,
      caseNoteCount: notes.length,
      inventoryRecordCount: inventory.length,
      extractedTextPath:
        canonical.textPath ||
        (batchId ? findExtractedTextPath(batchId, normalisedFile) : ""),
      contactSheetPath: batchId ? findContactSheetPath(batchId, normalisedFile) : "",
      needsDetailedVisionReview:
        !notes.length ||
        canonical.manualReviewReason.includes("no clear overall band") ||
        canonical.manualReviewReason.includes("possible multi-essay"),
      manualReviewReason: canonical.manualReviewReason || "",
      preview: canonical.preview,
      examinerCaseNotes: notes.map((note) => ({
        heading: note.heading,
        pageRange: note.pageRange,
        prompt: note.prompt,
        scoreSignal: note.scoreSignal,
        detailLevel: note.detailLevel,
        examinerPriorities: note.examinerPriorities,
        promptDesignLessons: note.promptDesignLessons,
        taxonomyUpdates: note.taxonomyUpdates,
        rawCaseNote: note.rawCaseNote,
      })),
    };
  });

  const representedNorms = new Set(pdfLogs.map((row) => row.normalisedFile));
  const orphanCaseNotes = caseNotes.filter((note) => note.normalisedFile && !representedNorms.has(note.normalisedFile));

  const expandedCaseLogs = [];
  for (const pdf of pdfLogs) {
    if (pdf.examinerCaseNotes.length) {
      pdf.examinerCaseNotes.forEach((note, index) => {
        expandedCaseLogs.push({
          caseId: `${pdf.sourceId}-case-${String(index + 1).padStart(2, "0")}`,
          parentSourceId: pdf.sourceId,
          file: pdf.file,
          batchId: pdf.batchId,
          detailLevel: note.detailLevel,
          score: pdf.score,
          heading: note.heading,
          pageRange: note.pageRange,
          prompt: note.prompt,
          examinerPriorities: note.examinerPriorities,
          promptDesignLessons: note.promptDesignLessons,
          taxonomyUpdates: note.taxonomyUpdates,
          rawCaseNote: note.rawCaseNote,
          extractedTextPath: pdf.extractedTextPath,
          contactSheetPath: pdf.contactSheetPath,
          readyForPromptComparison: true,
        });
      });
    } else {
      expandedCaseLogs.push({
        caseId: `${pdf.sourceId}-case-01`,
        parentSourceId: pdf.sourceId,
        file: pdf.file,
        batchId: pdf.batchId,
        detailLevel: pdf.detailLevel,
        score: pdf.score,
        heading: path.basename(pdf.file, ".pdf"),
        pageRange: "",
        prompt: "",
        examinerPriorities: pdf.sourceBankUse ? [pdf.sourceBankUse] : [],
        promptDesignLessons: [],
        taxonomyUpdates: [],
        rawCaseNote: "",
        extractedTextPath: pdf.extractedTextPath,
        contactSheetPath: pdf.contactSheetPath,
        readyForPromptComparison: pdf.detailLevel !== "canonical_inventory_only",
      });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeJsonl(path.join(OUT_DIR, "examiner-source-pdfs.jsonl"), pdfLogs);
  writeJsonl(path.join(OUT_DIR, "examiner-source-cases.jsonl"), expandedCaseLogs);
  fs.writeFileSync(path.join(OUT_DIR, "examiner-source-pdfs.json"), JSON.stringify(pdfLogs, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "examiner-source-cases.json"), JSON.stringify(expandedCaseLogs, null, 2));

  const summary = buildSummary({
    canonicalRows,
    pdfLogs,
    expandedCaseLogs,
    orphanCaseNotes,
    batchAudits,
  });
  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), summary);
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(
      {
        canonicalPdfCount: pdfLogs.length,
        expandedCaseCount: expandedCaseLogs.length,
        caseNotesAvailable: pdfLogs.filter((row) => row.caseNoteCount > 0).length,
        fileInventoryOnly: pdfLogs.filter((row) => row.detailLevel === "file_inventory_only").length,
        canonicalInventoryOnly: pdfLogs.filter((row) => row.detailLevel === "canonical_inventory_only").length,
        needsDetailedVisionReview: pdfLogs.filter((row) => row.needsDetailedVisionReview).length,
        orphanCaseNoteCount: orphanCaseNotes.length,
      },
      null,
      2,
    ),
  );

  console.log(summary);
}

function buildSummary({ canonicalRows, pdfLogs, expandedCaseLogs, orphanCaseNotes, batchAudits }) {
  const countBy = (rows, getKey) =>
    rows.reduce((acc, row) => {
      const key = getKey(row) || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const detailCounts = countBy(pdfLogs, (row) => row.detailLevel);
  const bucketCounts = countBy(pdfLogs, (row) => row.score.bucket);
  const scoreStatusCounts = countBy(pdfLogs, (row) => row.score.status);
  const needsReview = pdfLogs.filter((row) => row.needsDetailedVisionReview);

  const lines = [
    "# Examiner Source Detailed Log",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## What This Is",
    "",
    "This is the structured source log for the examiner-marked PDF bank. It preserves the existing visual audit notes at PDF and case level so the next step can run the current assessment prompt on the same cases and compare MiMo output against examiner judgement case by case.",
    "",
    "## Counts",
    "",
    `- Canonical unique PDFs: ${canonicalRows.length}`,
    `- Expanded source cases: ${expandedCaseLogs.length}`,
    `- Batch audit files used: ${batchAudits.length}`,
    `- Orphan case notes not matched to canonical PDFs: ${orphanCaseNotes.length}`,
    "",
    "## Detail Levels",
    "",
    ...Object.entries(detailCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Score Buckets",
    "",
    ...Object.entries(bucketCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Score Status",
    "",
    ...Object.entries(scoreStatusCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Files Needing Deeper Vision Review Before Final Calibration",
    "",
    ...needsReview
      .slice(0, 80)
      .map(
        (row) =>
          `- ${row.sourceId}: ${row.file} — ${row.detailLevel}; ${row.manualReviewReason || row.sourceBankUse || "file-level only"}`,
      ),
    needsReview.length > 80 ? `- ...${needsReview.length - 80} more` : "",
    "",
    "## Output Files",
    "",
    "- `tmp/marked-script-detailed-log/examiner-source-pdfs.jsonl`",
    "- `tmp/marked-script-detailed-log/examiner-source-cases.jsonl`",
    "- `tmp/marked-script-detailed-log/examiner-source-pdfs.json`",
    "- `tmp/marked-script-detailed-log/examiner-source-cases.json`",
  ].filter((line) => line !== "");

  return `${lines.join("\n")}\n`;
}

main();
