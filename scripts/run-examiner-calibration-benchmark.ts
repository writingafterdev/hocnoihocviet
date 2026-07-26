import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type InputRow = {
  caseId: string;
  sourcePdf: string;
  heading: string;
  bucket: string;
  score: { band?: number | string };
  scores: { overall?: string };
  question: string;
  essay: string;
  examinerPriorities: string[];
  promptDesignLessons: string[];
  rawCaseNote: string;
};

type CleanedRow = InputRow & {
  cleanedEssay: string;
  cleaning: {
    confidence: 'high' | 'medium' | 'low';
    notes: string;
    source: 'cache' | 'mimo';
  };
  queuedJob?: {
    id: string;
    benchmarkId: string;
    status: string;
  };
  processedResult?: unknown;
  processError?: string;
};

type CleanedEssayResponse = {
  cleanEssay: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

const ROOT = process.cwd();
const INPUT_PATH = path.resolve(
  argValue('--input')
    || path.join(ROOT, 'tmp/examiner-benchmark-inputs/examiner-benchmark-inputs-usable.jsonl'),
);
const OUT_DIR = path.resolve(
  argValue('--out-dir')
    || path.join(ROOT, 'tmp/examiner-calibration-run'),
);
const CACHE_INPUT_PATH = argValue('--cache-input')
  ? path.resolve(String(argValue('--cache-input')))
  : undefined;
const CLEANED_JSONL = path.join(OUT_DIR, 'cleaned-inputs.jsonl');
const RUN_SUMMARY = path.join(OUT_DIR, 'run-summary.json');

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function wordCount(value: string) {
  return (value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/g) || []).length;
}

async function loadRows(limit: number) {
  const raw = await readFile(INPUT_PATH, 'utf8');
  const requestedCaseIds = new Set(
    String(argValue('--case-ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const rows = raw
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as InputRow)
    .filter((row) => requestedCaseIds.size === 0 || requestedCaseIds.has(row.caseId));
  return Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
}

async function loadCleanedCache() {
  const cache = new Map<string, CleanedRow>();
  // Prefer this run's state, then use the shared cache only for missing cases.
  for (const cachePath of [CLEANED_JSONL, CACHE_INPUT_PATH].filter(Boolean) as string[]) {
    try {
      const raw = await readFile(cachePath, 'utf8');
      for (const line of raw.split(/\n+/).filter(Boolean)) {
        const row = JSON.parse(line) as CleanedRow;
        if (!cache.has(row.caseId)) {
          cache.set(row.caseId, row);
        }
      }
    } catch {
      // This cache source does not exist yet.
    }
  }
  return cache;
}

function buildCleaningPrompt(row: InputRow) {
  return `You are cleaning an IELTS Task 2 marked-script transcript before assessment.

The transcript was extracted from a PDF with track changes. It may contain:
- original student wording glued to examiner corrections
- inserted corrected words beside original words
- prompt text repeated
- score/rubric fragments
- leftover formatting noise

Your job: reconstruct the student's ORIGINAL essay only.

Rules:
- Preserve the student's real grammar mistakes, vocabulary mistakes, awkward wording, and weak argumentation.
- Remove examiner corrections, inserted alternatives, margin comments, score lines, rubric text, and formatting notes.
- Do not upgrade the essay.
- Do not rewrite for quality.
- Do not invent missing ideas.
- Keep paragraph breaks if you can infer them.
- If two adjacent alternatives appear, choose the less polished / more student-like original wording.
- Return JSON only.

JSON shape:
{
  "cleanEssay": "the reconstructed original student essay",
  "confidence": "high|medium|low",
  "notes": "short note about any uncertainty"
}

Exam question:
${row.question}

Marked transcript:
${row.essay}`;
}

async function cleanWithMimo(row: InputRow): Promise<CleanedEssayResponse> {
  const { generateAssessmentJSON } = await import('../src/lib/assessment-llm');
  return generateAssessmentJSON<CleanedEssayResponse>(
    'You clean marked-script transcripts into original IELTS student essays. Return valid JSON only.',
    buildCleaningPrompt(row),
    `examiner-calibration-clean-${row.caseId}`,
  );
}

async function cleanRows(rows: InputRow[]) {
  await mkdir(OUT_DIR, { recursive: true });
  const cache = await loadCleanedCache();
  const cleaned: CleanedRow[] = [];

  for (const row of rows) {
    const cached = cache.get(row.caseId);
    if (cached?.cleanedEssay) {
      cleaned.push({
        ...cached,
        cleaning: { ...cached.cleaning, source: 'cache' },
      });
      console.info('[examiner-calibration] clean cache', row.caseId);
      continue;
    }

    console.info('[examiner-calibration] cleaning', row.caseId, row.heading);
    const result = await cleanWithMimo(row);
    const cleanEssay = String(result.cleanEssay || '').trim();
    if (wordCount(cleanEssay) < 120) {
      throw new Error(`Cleaned essay too short for ${row.caseId}: ${wordCount(cleanEssay)} words.`);
    }
    cleaned.push({
      ...row,
      cleanedEssay: cleanEssay,
      cleaning: {
        confidence: result.confidence || 'low',
        notes: result.notes || '',
        source: 'mimo',
      },
    });

    await writeFile(
      CLEANED_JSONL,
      cleaned.map((item) => JSON.stringify(item)).join('\n') + '\n',
    );
  }

  await writeFile(
    CLEANED_JSONL,
    cleaned.map((item) => JSON.stringify(item)).join('\n') + '\n',
  );
  return cleaned;
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function enqueueRows(rows: CleanedRow[]) {
  const {
    enqueueBenchmarkReferenceJob,
    listBenchmarkReferenceJobs,
  } = await import('../src/lib/benchmark-reference-jobs');
  const queued: CleanedRow[] = [];
  const existingJobs = await listBenchmarkReferenceJobs(500);
  const existingBySourceUrl = new Map(existingJobs.map((job) => [job.sourceUrl, job]));
  const sourceVersion = argValue('--source-version') || 'examiner-calibration-clean-v2';
  const freshJobs = hasFlag('--fresh-jobs');

  for (const row of rows) {
    const sourceUrl = `${sourceVersion}:${row.caseId}:${shortHash(row.cleanedEssay)}:${row.sourcePdf}`;

    if (!freshJobs && row.queuedJob?.id) {
      console.info('[examiner-calibration] enqueue cache', row.caseId, row.queuedJob.id);
      queued.push(row);
      continue;
    }

    const existing = existingBySourceUrl.get(sourceUrl);
    if (existing) {
      console.info('[examiner-calibration] enqueue existing', row.caseId, existing.id);
      queued.push({
        ...row,
        queuedJob: {
          id: existing.id,
          benchmarkId: existing.benchmarkId,
          status: existing.status,
        },
        processedResult: undefined,
        processError: undefined,
      });
      continue;
    }

    console.info('[examiner-calibration] enqueue', row.caseId);
    const job = await enqueueBenchmarkReferenceJob({
      question: row.question,
      essay: row.cleanedEssay,
      scores: {
        overall: row.scores.overall || String(row.score.band || ''),
      },
      sourceUrl,
    });
    queued.push({
      ...row,
      queuedJob: {
        id: job.id,
        benchmarkId: job.benchmarkId,
        status: job.status,
      },
      processedResult: undefined,
      processError: undefined,
    });
  }

  await writeFile(
    CLEANED_JSONL,
    queued.map((item) => JSON.stringify(item)).join('\n') + '\n',
  );
  return queued;
}

async function processQueuedRows(rows: CleanedRow[], concurrency: number) {
  const {
    getBenchmarkReferenceJob,
    processBenchmarkReferenceJob,
  } = await import('../src/lib/benchmark-reference-jobs');

  const processed = await runPool(rows, concurrency, async (row) => {
    if (!row.queuedJob?.id) {
      return row;
    }
    if (row.processedResult) {
      console.info('[examiner-calibration] process cache', row.caseId, row.queuedJob.id);
      return row;
    }

    console.info('[examiner-calibration] process', row.caseId, row.queuedJob.id);
    try {
      const job = await getBenchmarkReferenceJob(row.queuedJob.id);
      if (job.status === 'complete') {
        console.info('[examiner-calibration] process complete cache', row.caseId, row.queuedJob.id);
        return {
          ...row,
          processedResult: {
            status: 'complete',
            jobId: job.id,
            benchmarkId: job.benchmarkId,
            resultId: job.resultId,
            cached: true,
          },
          processError: undefined,
        };
      }
      const result = await processBenchmarkReferenceJob(job);
      return {
        ...row,
        processedResult: result,
        processError: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[examiner-calibration] process failed', row.caseId, message);
      return {
        ...row,
        processError: message,
      };
    }
  });

  for (let index = 0; index < processed.length; index += 1) {
    await writeFile(
      CLEANED_JSONL,
      processed.slice(0, index + 1).concat(rows.slice(index + 1)).map((item) => JSON.stringify(item)).join('\n') + '\n',
    );
  }

  await writeFile(
    CLEANED_JSONL,
    processed.map((item) => JSON.stringify(item)).join('\n') + '\n',
  );
  return processed;
}

async function main() {
  const limit = Number(argValue('--limit') || 0);
  const concurrency = Math.min(Math.max(Number(argValue('--concurrency') || 3), 1), 6);
  const enqueue = hasFlag('--enqueue');
  const process = hasFlag('--process');

  const inputRows = await loadRows(limit);
  const cleaned = await cleanRows(inputRows);
  const queued = enqueue ? await enqueueRows(cleaned) : cleaned;
  const processed = process ? await processQueuedRows(queued, concurrency) : queued;

  const summary = {
    inputRows: inputRows.length,
    cleanedRows: cleaned.length,
    queuedRows: processed.filter((row) => row.queuedJob).length,
    processedRows: processed.filter((row) => row.processedResult).length,
    processErrors: processed.filter((row) => row.processError).length,
    confidence: processed.reduce<Record<string, number>>((acc, row) => {
      acc[row.cleaning.confidence] = (acc[row.cleaning.confidence] || 0) + 1;
      return acc;
    }, {}),
    output: CLEANED_JSONL,
  };
  await writeFile(RUN_SUMMARY, JSON.stringify(summary, null, 2));
  console.info('[examiner-calibration] summary', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[examiner-calibration] fatal', error);
  process.exitCode = 1;
});
