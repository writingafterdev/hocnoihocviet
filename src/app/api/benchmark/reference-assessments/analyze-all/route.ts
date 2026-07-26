import { NextResponse } from 'next/server';
import {
  getBenchmarkReferenceResultByBenchmarkId,
  listBenchmarkReferenceJobs,
  processBenchmarkReferenceJob,
  type BenchmarkReferenceJob,
} from '@/lib/benchmark-reference-jobs';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 500;
const DEFAULT_CONCURRENCY = 3;

type AnalyzeStatus = 'complete' | 'failed' | 'skipped';

interface AnalyzeAllRequest {
  limit?: number;
  concurrency?: number;
  includeFailed?: boolean;
  rerunLegacy?: boolean;
}

interface AnalyzeAllItem {
  jobId: string;
  benchmarkId: string;
  question: string;
  previousStatus: BenchmarkReferenceJob['status'];
  status: AnalyzeStatus;
  reason?: string;
  durationMs?: number;
  error?: string;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), min), max);
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function getAnalyzeReason(
  job: BenchmarkReferenceJob,
  options: { includeFailed: boolean; rerunLegacy: boolean },
) {
  if (job.status === 'running') return null;
  if (job.status === 'queued') return 'queued';
  if (job.status === 'failed') return options.includeFailed ? 'failed-retry' : null;

  if (job.status === 'complete' && options.rerunLegacy) {
    const result = await getBenchmarkReferenceResultByBenchmarkId(job.benchmarkId);
    if (!result || result.promptVersion === 'legacy-blob') return 'legacy-prompt-snapshot';
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as AnalyzeAllRequest;
    const limit = clampNumber(body.limit, DEFAULT_LIMIT, 1, 500);
    const concurrency = clampNumber(body.concurrency, DEFAULT_CONCURRENCY, 1, 6);
    const includeFailed = body.includeFailed !== false;
    const rerunLegacy = body.rerunLegacy !== false;
    const jobs = await listBenchmarkReferenceJobs(limit);

    const candidates: Array<{ job: BenchmarkReferenceJob; reason: string }> = [];
    const skipped: AnalyzeAllItem[] = [];

    for (const job of jobs) {
      const reason = await getAnalyzeReason(job, { includeFailed, rerunLegacy });
      if (reason) {
        candidates.push({ job, reason });
      } else {
        skipped.push({
          jobId: job.id,
          benchmarkId: job.benchmarkId,
          question: job.question,
          previousStatus: job.status,
          status: 'skipped',
          reason: job.status === 'running' ? 'already-running' : 'already-current',
        });
      }
    }

    const processed = await runPool(candidates, concurrency, async ({ job, reason }): Promise<AnalyzeAllItem> => {
      try {
        const result = await processBenchmarkReferenceJob(job);
        return {
          jobId: job.id,
          benchmarkId: job.benchmarkId,
          question: job.question,
          previousStatus: job.status,
          status: 'complete',
          reason,
          durationMs: result.durationMs,
        };
      } catch (error) {
        return {
          jobId: job.id,
          benchmarkId: job.benchmarkId,
          question: job.question,
          previousStatus: job.status,
          status: 'failed',
          reason,
          error: error instanceof Error ? error.message : 'Unknown benchmark analysis error.',
        };
      }
    });

    const results = [...processed, ...skipped];
    const completed = processed.filter((item) => item.status === 'complete').length;
    const failed = processed.filter((item) => item.status === 'failed').length;

    return NextResponse.json({
      success: failed === 0,
      limit,
      concurrency,
      candidates: candidates.length,
      completed,
      failed,
      skipped: skipped.length,
      results,
    });
  } catch (error) {
    console.error('Benchmark analyze-all error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze benchmark jobs.' },
      { status: 500 },
    );
  }
}
