import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { filterBenchmarkAssessmentMarkdown } from '../src/lib/benchmark-postgen-filter';

type CalibrationResultRow = {
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
    postGenerationFilter?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function markdownFor(rows: CalibrationResultRow[]) {
  return [
    '# Examiner Calibration Results - Post-Generation Filtered',
    '',
    `Cases: ${rows.length}`,
    '',
    ...rows.flatMap((row) => [
      `## ${row.caseId} - ${row.heading}`,
      '',
      `Source: \`${row.sourcePdf}\``,
      '',
      `Examiner overall: ${row.examinerOverall || 'unknown'} | Bucket: ${row.bucket}`,
      '',
      '### Question',
      '',
      row.question.trim(),
      '',
      '### Examiner Priorities',
      '',
      ...row.examinerPriorities.map((priority) => `- ${priority}`),
      '',
      '### Post-Generation Filter',
      '',
      row.result?.postGenerationFilter
        ? '```json\n' + JSON.stringify(row.result.postGenerationFilter, null, 2) + '\n```'
        : 'No filter audit.',
      '',
      '### Filtered Prompt Output',
      '',
      row.result?.assessmentMarkdown?.trim() || 'Missing result.',
      '',
      '---',
      '',
    ]),
  ].join('\n');
}

async function main() {
  const root = process.cwd();
  const inputPath = path.resolve(
    argValue('--input')
      || path.join(root, 'tmp/examiner-calibration-audit/v2.2.7-merged/results.json'),
  );
  const outDir = path.resolve(
    argValue('--out-dir')
      || path.join(root, 'tmp/examiner-calibration-audit/v2.2.7-postgen-filtered'),
  );
  const rows = JSON.parse(await readFile(inputPath, 'utf8')) as CalibrationResultRow[];

  const filteredRows = rows.map((row) => {
    if (!row.result?.assessmentMarkdown) return row;
    const filtered = filterBenchmarkAssessmentMarkdown({
      markdown: row.result.assessmentMarkdown,
      essay: row.cleanedEssay,
      scores: { overall: row.examinerOverall },
    });
    return {
      ...row,
      result: {
        ...row.result,
        assessmentMarkdown: filtered.markdown,
        postGenerationFilter: filtered.audit,
      },
    };
  });

  const filterStats = filteredRows.reduce(
    (acc, row) => {
      const audit = row.result?.postGenerationFilter as { keptCount?: number; removedCount?: number } | undefined;
      acc.kept += audit?.keptCount || 0;
      acc.removed += audit?.removedCount || 0;
      return acc;
    },
    { kept: 0, removed: 0 },
  );

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(filteredRows, null, 2));
  await writeFile(markdownPath, markdownFor(filteredRows));
  console.info(JSON.stringify({
    cases: filteredRows.length,
    filterStats,
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
