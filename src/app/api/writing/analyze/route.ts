import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AssessmentAuthenticationError, requireAssessmentUser } from '@/lib/appwrite-auth-server';
import { AssessmentRateLimitError, acquireAssessmentSlot } from '@/lib/assessment-rate-limit';
import { withAssessmentRun } from '@/lib/assessment-run-context';
import { buildEssayManifest } from '@/lib/writing-analysis-contract';
import { ACTIVE_ASSESSMENT_PROMPT_VERSION } from '@/lib/writing-assessment-author-prompts';
import { runWritingAssessmentPipelineV8 } from '@/lib/writing-assessment-pipeline-v2';
import { loadWritingAssessment, saveWritingAssessment } from '@/lib/writing-assessment-store';
import { getPromptById } from '@/lib/prompts';
import type { AssessmentRun, WritingAnalysis } from '@/types/writing';

const MAX_BODY_BYTES = 100_000;
const MAX_PROMPT_CHARS = 4_000;
const MAX_ESSAY_CHARS = 30_000;
const MAX_ESSAY_WORDS = 5_000;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

const inFlightAssessments = new Map<string, Promise<{ analysis: WritingAnalysis; assessmentId: string }>>();

function configuredProvider() {
  const provider = process.env.ASSESSMENT_LLM_PROVIDER?.toLowerCase() || 'grok';
  const model = provider === 'mimo'
    ? process.env.MIMO_MODEL || 'mimo-v2.5'
    : provider === 'deepseek'
      ? process.env.DEEPSEEK_MODEL || 'deepseek-chat'
      : process.env.GROK_MODEL || 'grok-4.3';
  return { provider, model };
}

function errorResponse(error: unknown) {
  if (error instanceof AssessmentAuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof AssessmentRateLimitError) {
    return NextResponse.json(
      { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
    );
  }
  console.error('Writing analyze error:', error);
  return NextResponse.json(
    { error: 'Assessment could not be completed. Please try again.' },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  try {
    const user = await requireAssessmentUser(req);
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const taskId = typeof input.taskId === 'string' ? input.taskId.trim() : '';
    const submittedPrompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    const essay = typeof input.essay === 'string' ? input.essay : '';
    const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey : '';
    const promptRecord = getPromptById(taskId);

    if (!promptRecord || promptRecord.task !== 'task2') {
      return NextResponse.json({ error: 'Unknown writing task.' }, { status: 400 });
    }
    if (!submittedPrompt || submittedPrompt !== promptRecord.text || submittedPrompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json({ error: 'The submitted prompt does not match this writing task.' }, { status: 400 });
    }
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json({ error: 'A valid idempotency key is required.' }, { status: 400 });
    }

    const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
    if (wordCount < 100) {
      return NextResponse.json({ error: 'Essay is too short. Please write at least 100 words.' }, { status: 400 });
    }
    if (essay.length > MAX_ESSAY_CHARS || wordCount > MAX_ESSAY_WORDS) {
      return NextResponse.json({ error: 'Essay is too long to assess safely.' }, { status: 413 });
    }

    try {
      const stored = await loadWritingAssessment(user.$id, taskId);
      const storedAnalysis = JSON.parse(String(stored.analysis_json || 'null')) as WritingAnalysis | null;
      if (storedAnalysis?.run?.idempotencyKey === idempotencyKey) {
        const sameInput = String(stored.prompt || '') === promptRecord.text
          && String(stored.essay || '') === essay;
        if (!sameInput) {
          return NextResponse.json(
            { error: 'This idempotency key was already used for different content.' },
            { status: 409 },
          );
        }
        return NextResponse.json({
          analysis: storedAnalysis,
          assessmentId: storedAnalysis.run.assessmentId,
        });
      }
    } catch (error: unknown) {
      const isNotFound = typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
      if (!isNotFound) throw error;
    }

    const requestKey = `${user.$id}:${idempotencyKey}`;
    const existing = inFlightAssessments.get(requestKey);
    if (existing) {
      const result = await existing;
      return NextResponse.json(result);
    }

    releaseSlot = acquireAssessmentSlot(user.$id);
    const assessmentId = randomUUID();
    const { provider, model } = configuredProvider();
    const startedAt = new Date().toISOString();
    let incompletePasses: string[] = [];
    const initialRun: AssessmentRun = {
      schemaVersion: '2026-07-28',
      assessmentId,
      idempotencyKey,
      pipelineVersion: 'v8',
      promptVersion: ACTIVE_ASSESSMENT_PROMPT_VERSION,
      provider,
      model,
      startedAt,
      status: 'complete',
      incompletePasses: [],
    };

    const operation = (async () => {
      const manifest = buildEssayManifest(essay);
      const result = await withAssessmentRun(initialRun, async () => (
        runWritingAssessmentPipelineV8({
          prompt: promptRecord.text,
          essay,
          manifest,
          includeComparison: false,
          onIncompletePasses: passes => {
            incompletePasses = passes;
          },
        })
      ));
      result.run.status = incompletePasses.length ? 'partial' : 'complete';
      result.run.incompletePasses = incompletePasses;
      result.value.run = result.run;
      await saveWritingAssessment({
        userId: user.$id,
        taskId,
        prompt: promptRecord.text,
        essay,
        analysis: result.value,
      });
      return { analysis: result.value, assessmentId };
    })();

    inFlightAssessments.set(requestKey, operation);
    try {
      return NextResponse.json(await operation);
    } finally {
      inFlightAssessments.delete(requestKey);
    }
  } catch (error: unknown) {
    return errorResponse(error);
  } finally {
    releaseSlot?.();
  }
}
