import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  alignAssessmentWithExaminer,
  EXAMINER_FINDING_ALIGNMENT_VERSION,
  type ExaminerFindingAlignmentResult,
} from '../src/lib/examiner-finding-alignment';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type CalibrationRow = {
  caseId: string;
  sourcePdf: string;
  heading: string;
  bucket: string;
  examinerOverall: string;
  question: string;
  cleanedEssay: string;
  examinerPriorities: string[];
  result?: {
    promptVersion: string;
    assessmentMarkdown: string;
  };
};

type AlignmentRow = {
  caseId: string;
  sourcePdf: string;
  heading: string;
  bucket: string;
  examinerOverall: string;
  assessmentPromptVersion: string;
  alignmentVersion: string;
  alignment?: ExaminerFindingAlignmentResult;
  error?: string;
};

const ROOT = process.cwd();
const DEFAULT_INPUT = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/v2/results.json',
);
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/finding-alignment-v1',
);

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );
  return results;
}

function metricCounts(rows: AlignmentRow[]) {
  const ai = rows.flatMap((row) => row.alignment?.aiFindings || []);
  const examiner = rows.flatMap(
    (row) => row.alignment?.examinerPriorities || [],
  );
  const count = <T extends string>(
    values: T[],
    target: T,
  ) => values.filter((value) => value === target).length;
  const aiVerdicts = ai.map((item) => item.verdict);
  const examinerVerdicts = examiner.map((item) => item.verdict);
  return {
    aiFindings: ai.length,
    corroborated: count(aiVerdicts, 'corroborated'),
    partiallyCorroborated: count(aiVerdicts, 'partially_corroborated'),
    contradictedByExaminer: count(aiVerdicts, 'contradicted_by_examiner'),
    notVerifiable: count(aiVerdicts, 'not_verifiable_from_reference'),
    examinerPriorities: examiner.length,
    covered: count(examinerVerdicts, 'covered'),
    partiallyCovered: count(examinerVerdicts, 'partially_covered'),
    missed: count(examinerVerdicts, 'missed'),
    notAssessmentTarget: count(examinerVerdicts, 'not_assessment_target'),
  };
}

function markdownFor(rows: AlignmentRow[]) {
  const metrics = metricCounts(rows);
  return [
    '# Examiner Finding Alignment',
    '',
    `Cases: ${rows.length}`,
    '',
    '## Aggregate counts',
    '',
    `- AI findings: ${metrics.aiFindings}`,
    `- Corroborated: ${metrics.corroborated}`,
    `- Partially corroborated: ${metrics.partiallyCorroborated}`,
    `- Contradicted by examiner: ${metrics.contradictedByExaminer}`,
    `- Not verifiable from summarized reference: ${metrics.notVerifiable}`,
    `- Examiner priorities: ${metrics.examinerPriorities}`,
    `- Covered: ${metrics.covered}`,
    `- Partially covered: ${metrics.partiallyCovered}`,
    `- Missed: ${metrics.missed}`,
    `- Not assessment targets: ${metrics.notAssessmentTarget}`,
    '',
    ...rows.flatMap((row) => [
      `## ${row.caseId} - ${row.heading}`,
      '',
      `Examiner overall: ${row.examinerOverall} | Bucket: ${row.bucket}`,
      '',
      '### AI findings',
      '',
      ...(row.alignment?.aiFindings.length
        ? row.alignment.aiFindings.map(
          (item) =>
            `- **${item.verdict}** ${item.findingTitle} (${item.criterion}) -> priorities ${item.examinerPriorityIndexes.join(', ') || 'none'}: ${item.rationale}`,
        )
        : ['- None']),
      '',
      '### Examiner priorities',
      '',
      ...(row.alignment?.examinerPriorities.length
        ? row.alignment.examinerPriorities.map(
          (item) =>
            `- **${item.verdict}** Priority ${item.priorityIndex} -> ${item.aiFindingTitles.join('; ') || 'no AI finding'}: ${item.rationale}`,
        )
        : ['- None']),
      '',
      row.alignment?.summary || row.error || '',
      '',
      '---',
      '',
    ]),
  ].join('\n');
}

async function main() {
  const inputPath = path.resolve(argValue('--input') || DEFAULT_INPUT);
  const outDir = path.resolve(argValue('--out-dir') || DEFAULT_OUT_DIR);
  const concurrency = Math.min(
    Math.max(Number(argValue('--concurrency') || 4), 1),
    6,
  );
  const requestedCaseIds = new Set(
    String(argValue('--case-ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const rows = (JSON.parse(
    await readFile(inputPath, 'utf8'),
  ) as CalibrationRow[]).filter(
    (row) => requestedCaseIds.size === 0 || requestedCaseIds.has(row.caseId),
  );
  await mkdir(outDir, { recursive: true });

  const aligned = await runPool(rows, concurrency, async (row): Promise<AlignmentRow> => {
    const base = {
      caseId: row.caseId,
      sourcePdf: row.sourcePdf,
      heading: row.heading,
      bucket: row.bucket,
      examinerOverall: row.examinerOverall,
      assessmentPromptVersion: row.result?.promptVersion || 'missing',
      alignmentVersion: EXAMINER_FINDING_ALIGNMENT_VERSION,
    };
    if (!row.result?.assessmentMarkdown) {
      return { ...base, error: 'Missing assessment markdown.' };
    }
    console.info('[examiner-finding-alignment]', row.caseId);
    try {
      const alignment = await alignAssessmentWithExaminer({
        question: row.question,
        essay: row.cleanedEssay,
        examinerPriorities: row.examinerPriorities,
        assessmentMarkdown: row.result.assessmentMarkdown,
        requestLabel: `examiner-finding-alignment-${row.caseId}`,
      });
      return { ...base, alignment };
    } catch (error) {
      return {
        ...base,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(aligned, null, 2));
  await writeFile(markdownPath, markdownFor(aligned));
  console.info(JSON.stringify({
    cases: aligned.length,
    errors: aligned.filter((row) => row.error).length,
    metrics: metricCounts(aligned),
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
