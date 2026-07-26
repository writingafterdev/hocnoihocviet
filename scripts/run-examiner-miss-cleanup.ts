import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanExaminerMisses,
  EXAMINER_MISS_CLEANUP_VERSION,
  provisionalMissedIndexes,
  type ExaminerMissCleanupResult,
} from '../src/lib/examiner-miss-cleanup';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type SourceRow = {
  caseId: string;
  heading: string;
  question: string;
  cleanedEssay: string;
  examinerPriorities: string[];
  result?: { promptVersion: string; assessmentMarkdown: string };
};

type AlignmentRow = {
  caseId: string;
  alignment?: {
    examinerPriorities: Array<{
      priorityIndex: number;
      verdict: string;
    }>;
  };
};

type CleanupRow = {
  caseId: string;
  heading: string;
  assessmentPromptVersion: string;
  cleanupVersion: string;
  provisionalMissedCount: number;
  cleanup?: ExaminerMissCleanupResult;
  error?: string;
};

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/v2.1-full/results.json',
);
const DEFAULT_ALIGNMENT = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/finding-alignment-v2.1.1/results.json',
);
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/miss-cleanup-v2.1',
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

function counts(rows: CleanupRow[]) {
  const decisions = rows.flatMap((row) => row.cleanup?.decisions || []);
  const verdicts = decisions.map((decision) => decision.verdict);
  const count = (target: string) =>
    verdicts.filter((verdict) => verdict === target).length;
  return {
    provisional: rows.reduce(
      (total, row) => total + row.provisionalMissedCount,
      0,
    ),
    decisions: decisions.length,
    confirmedMisses: count('confirmed_miss'),
    covered: count('covered'),
    partiallyCovered: count('partially_covered'),
    duplicates: count('duplicate'),
    positiveFeedback: count('positive_feedback'),
    optionalOrProcessAdvice: count('optional_or_process_advice'),
  };
}

function markdownFor(rows: CleanupRow[]) {
  const metrics = counts(rows);
  return [
    '# Examiner Miss Cleanup',
    '',
    `Cases: ${rows.length}`,
    '',
    '## Counts',
    '',
    `- Provisional missed rows: ${metrics.provisional}`,
    `- Decisions returned: ${metrics.decisions}`,
    `- Confirmed misses: ${metrics.confirmedMisses}`,
    `- Actually covered: ${metrics.covered}`,
    `- Partially covered: ${metrics.partiallyCovered}`,
    `- Duplicates: ${metrics.duplicates}`,
    `- Positive feedback: ${metrics.positiveFeedback}`,
    `- Optional/process advice: ${metrics.optionalOrProcessAdvice}`,
    '',
    ...rows.flatMap((row) => [
      `## ${row.caseId} - ${row.heading}`,
      '',
      ...(row.cleanup?.decisions.length
        ? row.cleanup.decisions.map(
          (decision) =>
            `- **${decision.verdict}** Priority ${decision.priorityIndex} [${decision.errorFamily}]${decision.duplicateOfPriorityIndex ? ` duplicate of ${decision.duplicateOfPriorityIndex}` : ''}: ${decision.rationale}`,
        )
        : [`- ${row.error || row.cleanup?.summary || 'No provisional misses.'}`]),
      '',
    ]),
  ].join('\n');
}

async function main() {
  const sourcePath = path.resolve(argValue('--source') || DEFAULT_SOURCE);
  const alignmentPath = path.resolve(
    argValue('--alignment') || DEFAULT_ALIGNMENT,
  );
  const outDir = path.resolve(argValue('--out-dir') || DEFAULT_OUT_DIR);
  const concurrency = Math.min(
    Math.max(Number(argValue('--concurrency') || 6), 1),
    6,
  );
  const sources = JSON.parse(
    await readFile(sourcePath, 'utf8'),
  ) as SourceRow[];
  const alignments = JSON.parse(
    await readFile(alignmentPath, 'utf8'),
  ) as AlignmentRow[];
  const alignmentByCase = new Map(
    alignments.map((row) => [row.caseId, row]),
  );
  await mkdir(outDir, { recursive: true });

  const cleaned = await runPool(sources, concurrency, async (row): Promise<CleanupRow> => {
    const alignment = alignmentByCase.get(row.caseId);
    const missedIndexes = provisionalMissedIndexes(
      alignment?.alignment?.examinerPriorities || [],
    );
    const base = {
      caseId: row.caseId,
      heading: row.heading,
      assessmentPromptVersion: row.result?.promptVersion || 'missing',
      cleanupVersion: EXAMINER_MISS_CLEANUP_VERSION,
      provisionalMissedCount: missedIndexes.length,
    };
    if (!row.result?.assessmentMarkdown) {
      return { ...base, error: 'Missing assessment markdown.' };
    }
    console.info('[examiner-miss-cleanup]', row.caseId, missedIndexes.length);
    try {
      const cleanup = await cleanExaminerMisses({
        question: row.question,
        essay: row.cleanedEssay,
        examinerPriorities: row.examinerPriorities,
        provisionalMissedIndexes: missedIndexes,
        assessmentMarkdown: row.result.assessmentMarkdown,
        requestLabel: `examiner-miss-cleanup-${row.caseId}`,
      });
      return { ...base, cleanup };
    } catch (error) {
      return {
        ...base,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(cleaned, null, 2));
  await writeFile(markdownPath, markdownFor(cleaned));
  console.info(JSON.stringify({
    cases: cleaned.length,
    errors: cleaned.filter((row) => row.error).length,
    metrics: counts(cleaned),
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
