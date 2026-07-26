import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type CalibrationRow = {
  caseId: string;
  sourcePdf: string;
  heading: string;
  bucket: string;
  scores: { overall?: string };
  question: string;
  cleanedEssay: string;
  examinerPriorities: string[];
  promptDesignLessons: string[];
  cleaning: { confidence: string; notes: string };
  queuedJob?: { id: string; benchmarkId: string; status: string };
  processedResult?: { resultId?: string };
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const ROOT = process.cwd();
const IN_PATH = path.resolve(
  argValue('--input')
    || path.join(ROOT, 'tmp/examiner-calibration-run/cleaned-inputs.jsonl'),
);
const OUT_DIR = path.resolve(
  argValue('--out-dir')
    || path.join(ROOT, 'tmp/examiner-calibration-audit'),
);
const OUT_JSON = path.join(OUT_DIR, 'results.json');
const OUT_MD = path.join(OUT_DIR, 'results.md');

function mdEscape(value: string) {
  return value.replace(/\r/g, '').trim();
}

function extractReportedScores(markdown: string) {
  const text = markdown.slice(0, 2500);
  const scoreLine = text.match(/(?:score|band|overall)[^\n]{0,120}/i)?.[0] || '';
  const numbers = Array.from(text.matchAll(/\b(?:[0-9](?:\.5)?)\b/g)).map((match) => match[0]);
  return {
    scoreLine,
    firstNumbers: numbers.slice(0, 12),
  };
}

async function main() {
  const { getBenchmarkReferenceResultByBenchmarkId } = await import('../src/lib/benchmark-reference-jobs');
  const raw = await readFile(IN_PATH, 'utf8');
  const rows = raw
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CalibrationRow);

  await mkdir(OUT_DIR, { recursive: true });

  const exported = [];
  for (const row of rows) {
    const benchmarkId = row.queuedJob?.benchmarkId;
    if (!benchmarkId) {
      exported.push({ ...row, result: null, resultError: 'missing benchmark id' });
      continue;
    }
    const result = await getBenchmarkReferenceResultByBenchmarkId(benchmarkId);
    exported.push({
      caseId: row.caseId,
      sourcePdf: row.sourcePdf,
      heading: row.heading,
      bucket: row.bucket,
      examinerOverall: row.scores.overall || '',
      question: row.question,
      cleanedEssay: row.cleanedEssay,
      cleaning: row.cleaning,
      examinerPriorities: row.examinerPriorities,
      promptDesignLessons: row.promptDesignLessons,
      job: row.queuedJob,
      result: result
        ? {
          id: result.id,
          promptVersion: result.promptVersion,
          createdAt: result.createdAt,
          reportedScores: extractReportedScores(result.assessmentMarkdown),
          assessmentMarkdown: result.assessmentMarkdown,
        }
        : null,
      resultError: result ? '' : 'missing result document',
    });
  }

  await writeFile(OUT_JSON, JSON.stringify(exported, null, 2));

  const markdown = [
    '# Examiner Calibration Results',
    '',
    `Cases: ${exported.length}`,
    '',
    ...exported.flatMap((item) => [
      `## ${item.caseId} - ${item.heading}`,
      '',
      `Source: \`${item.sourcePdf}\``,
      '',
      `Examiner overall: ${item.examinerOverall || 'unknown'} | Bucket: ${item.bucket} | Cleaning: ${item.cleaning.confidence}`,
      '',
      '### Question',
      '',
      mdEscape(item.question),
      '',
      '### Examiner Priorities',
      '',
      ...item.examinerPriorities.map((priority: string) => `- ${priority}`),
      '',
      '### Prompt Design Lessons From Examiner',
      '',
      ...item.promptDesignLessons.map((lesson: string) => `- ${lesson}`),
      '',
      '### Current Prompt Output',
      '',
      item.result?.assessmentMarkdown?.trim() || `Missing result: ${item.resultError}`,
      '',
      '---',
      '',
    ]),
  ].join('\n');

  await writeFile(OUT_MD, markdown);
  console.info(JSON.stringify({
    cases: exported.length,
    missingResults: exported.filter((item) => !item.result).length,
    outputJson: OUT_JSON,
    outputMarkdown: OUT_MD,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
