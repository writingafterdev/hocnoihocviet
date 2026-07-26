import { NextResponse } from 'next/server';
import {
  getBenchmarkReferenceJob,
  getBenchmarkReferenceReviewByJobId,
  getBenchmarkReferenceResultByBenchmarkId,
  upsertBenchmarkReferenceReview,
  type BenchmarkReviewPayload,
} from '@/lib/benchmark-reference-jobs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const job = await getBenchmarkReferenceJob(id);
    const result = job.resultId
      ? await getBenchmarkReferenceResultByBenchmarkId(job.benchmarkId)
      : null;
    const review = await getBenchmarkReferenceReviewByJobId(job.id);

    return NextResponse.json({ job, result, review });
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'code' in error && error.code === 404
        ? 404
        : 500;
    return NextResponse.json(
      { error: status === 404 ? 'Benchmark job not found.' : 'Failed to load benchmark job.' },
      { status },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const job = await getBenchmarkReferenceJob(id);
    const body = await request.json() as { review?: BenchmarkReviewPayload };
    const review = await upsertBenchmarkReferenceReview({
      jobId: job.id,
      benchmarkId: job.benchmarkId,
      review: body.review || {},
    });

    return NextResponse.json({ job, review });
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'code' in error && error.code === 404
        ? 404
        : 500;
    return NextResponse.json(
      { error: status === 404 ? 'Benchmark job not found.' : 'Failed to save benchmark review.' },
      { status },
    );
  }
}
