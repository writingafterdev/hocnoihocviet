import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBenchmarkReferenceJobs,
  enqueueBenchmarkReferenceJob,
  listBenchmarkReferenceJobs,
  type ExternalScores,
} from '@/lib/benchmark-reference-jobs';
import { buildBenchmarkReferencePrompt } from '@/lib/benchmark-reference-prompt';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ReferenceAssessmentRequest {
  question?: string;
  essay?: string;
  scores?: ExternalScores;
  sourceUrl?: string;
}

function assertString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }
  return value.trim();
}

function looksLikePageChrome(text: string) {
  return /(band score|task response|coherence\s*&\s*cohesion|lexical resource|grammatical range|tra từ vựng|ghi chú|youpass sửa bài|sample từ youpass|làm lại|xem lại)/i.test(text);
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers || {}),
    },
  });
}

export function OPTIONS() {
  return jsonResponse({});
}

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || 50);
    const jobs = await listBenchmarkReferenceJobs(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 50);
    return jsonResponse({ jobs });
  } catch (error) {
    console.error('Benchmark jobs list error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to list benchmark jobs.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ReferenceAssessmentRequest;
    const question = assertString(body.question, 'question');
    const essay = assertString(body.essay, 'essay');
    const filledPrompt = buildBenchmarkReferencePrompt({
      question,
      essay,
      scores: body.scores || {},
      sourceUrl: body.sourceUrl || '',
    });

    if (essay.split(/\s+/).length < 80) {
      return jsonResponse({ error: 'Essay is too short or was not extracted correctly.' }, { status: 400 });
    }
    if (looksLikePageChrome(essay)) {
      return jsonResponse({ error: 'Extracted essay still contains page UI text. Open the detail page and try again after reloading the extension.' }, { status: 400 });
    }
    if (filledPrompt.length > 50_000) {
      return jsonResponse({ error: 'Filled prompt is too large.' }, { status: 413 });
    }

    const job = await enqueueBenchmarkReferenceJob({
      question,
      essay,
      scores: body.scores || {},
      sourceUrl: body.sourceUrl || '',
    });

    return jsonResponse({
      success: true,
      queued: true,
      job,
    });
  } catch (error) {
    console.error('Benchmark enqueue error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to enqueue benchmark assessment.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
    const result = await deleteBenchmarkReferenceJobs(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100);
    return jsonResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Benchmark delete error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to delete benchmark jobs.' },
      { status: 500 },
    );
  }
}
