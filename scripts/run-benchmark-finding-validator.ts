import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BENCHMARK_FINDING_VALIDATOR_VERSION,
  validateBenchmarkFindings,
  type BenchmarkFindingValidationResult,
} from '../src/lib/benchmark-finding-validator';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type CalibrationRow = {
  caseId: string;
  heading: string;
  question: string;
  cleanedEssay: string;
  result?: {
    promptVersion: string;
    assessmentMarkdown: string;
  };
};

type ValidationRow = {
  caseId: string;
  heading: string;
  assessmentPromptVersion: string;
  validatorVersion: string;
  validation?: BenchmarkFindingValidationResult;
  error?: string;
};

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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

function markdownFor(rows: ValidationRow[]) {
  return [
    '# Benchmark Finding Validation',
    '',
    `Cases: ${rows.length}`,
    '',
    ...rows.flatMap((row) => [
      `## ${row.caseId} - ${row.heading}`,
      '',
      `Assessment: \`${row.assessmentPromptVersion}\` | Validator: \`${row.validatorVersion}\``,
      '',
      '### Decisions',
      '',
      ...(row.validation?.decisions.length
        ? row.validation.decisions.map((item) =>
          `- **${item.verdict}** Finding ${item.findingIndex} — ${item.title}: ${item.rationale}`)
        : [`- ${row.error || 'No findings.'}`]),
      '',
      '### Omitted findings',
      '',
      ...(row.validation?.omissions.length
        ? row.validation.omissions.map((item) =>
          `- **${item.criterion} / ${item.severity}** ${item.title} — “${item.evidence}”: ${item.rationale}`)
        : ['- None']),
      '',
      row.validation?.summary || '',
      '',
      '---',
      '',
    ]),
  ].join('\n');
}

async function main() {
  const inputPath = path.resolve(String(argValue('--input') || ''));
  const outDir = path.resolve(argValue('--out-dir') || 'tmp/benchmark-finding-validator');
  const concurrency = Math.min(Math.max(Number(argValue('--concurrency') || 3), 1), 6);
  if (!argValue('--input')) throw new Error('Missing --input.');

  const rows = JSON.parse(await readFile(inputPath, 'utf8')) as CalibrationRow[];
  await mkdir(outDir, { recursive: true });
  const validated = await runPool(rows, concurrency, async (row): Promise<ValidationRow> => {
    const base = {
      caseId: row.caseId,
      heading: row.heading,
      assessmentPromptVersion: row.result?.promptVersion || 'missing',
      validatorVersion: BENCHMARK_FINDING_VALIDATOR_VERSION,
    };
    if (!row.result?.assessmentMarkdown) {
      return { ...base, error: 'Missing assessment markdown.' };
    }
    console.info('[benchmark-finding-validator]', row.caseId);
    try {
      return {
        ...base,
        validation: await validateBenchmarkFindings({
          question: row.question,
          essay: row.cleanedEssay,
          assessmentMarkdown: row.result.assessmentMarkdown,
          requestLabel: `benchmark-finding-validator-${row.caseId}`,
        }),
      };
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message : String(error) };
    }
  });

  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(validated, null, 2));
  await writeFile(markdownPath, markdownFor(validated));
  console.info(JSON.stringify({
    cases: validated.length,
    errors: validated.filter((row) => row.error).length,
    decisions: validated.flatMap((row) => row.validation?.decisions || []).reduce(
      (counts, decision) => ({
        ...counts,
        [decision.verdict]: (counts[decision.verdict] || 0) + 1,
      }),
      {} as Record<string, number>,
    ),
    omissions: validated.reduce(
      (total, row) => total + (row.validation?.omissions.length || 0),
      0,
    ),
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
