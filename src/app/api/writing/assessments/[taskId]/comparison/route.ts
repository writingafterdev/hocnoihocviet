import { NextResponse } from 'next/server';
import { AssessmentAuthenticationError, requireAssessmentUser } from '@/lib/appwrite-auth-server';
import { AssessmentRateLimitError, acquireAssessmentSlot } from '@/lib/assessment-rate-limit';
import { withAssessmentRun } from '@/lib/assessment-run-context';
import { alignWritingAnalysis, buildEssayManifest, validateWritingAnalysis } from '@/lib/writing-analysis-contract';
import { generateAssessmentComparison } from '@/lib/writing-assessment-pipeline-v2';
import { loadWritingAssessment, saveWritingAssessment } from '@/lib/writing-assessment-store';
import { hasVerifiedComparisonChanges } from '@/lib/writing-assessment-findings';
import type { AssessmentRun, WritingAnalysis } from '@/types/writing';

type RouteContext = { params: Promise<{ taskId: string }> };

function addUsage(
  left: AssessmentRun['usage'],
  right: AssessmentRun['usage'],
): NonNullable<AssessmentRun['usage']> {
  return {
    promptTokens: (left?.promptTokens || 0) + (right?.promptTokens || 0),
    completionTokens: (left?.completionTokens || 0) + (right?.completionTokens || 0),
    totalTokens: (left?.totalTokens || 0) + (right?.totalTokens || 0),
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  let releaseSlot: (() => void) | undefined;
  try {
    const user = await requireAssessmentUser(request);
    releaseSlot = acquireAssessmentSlot(user.$id);
    const document = await loadWritingAssessment(user.$id, taskId);
    const essay = String(document.essay || '');
    const prompt = String(document.prompt || '');
    const storedAnalysis = JSON.parse(String(document.analysis_json || 'null')) as WritingAnalysis;
    const manifest = buildEssayManifest(essay);
    const analysis = alignWritingAnalysis(storedAnalysis, essay, manifest);
    if (validateWritingAnalysis(analysis, manifest, essay).length) {
      return NextResponse.json(
        { error: 'Stored assessment is incompatible with the current review format.' },
        { status: 422 },
      );
    }

    if (hasVerifiedComparisonChanges(analysis, essay)) {
      return NextResponse.json({ comparison: analysis.comparison, analysis });
    }

    const previousRun = analysis.run;
    const lazyRun: AssessmentRun = {
      schemaVersion: '2026-07-28',
      assessmentId: previousRun?.assessmentId || crypto.randomUUID(),
      idempotencyKey: `${previousRun?.idempotencyKey || 'comparison'}:comparison`,
      pipelineVersion: 'v8',
      promptVersion: previousRun?.promptVersion || 'unknown',
      provider: previousRun?.provider || process.env.ASSESSMENT_LLM_PROVIDER || 'grok',
      model: previousRun?.model || 'unknown',
      startedAt: new Date().toISOString(),
      status: previousRun?.status || 'complete',
      incompletePasses: previousRun?.incompletePasses || [],
    };
    const generated = await withAssessmentRun(lazyRun, () => (
      generateAssessmentComparison({ prompt, essay, analysis })
    ));
    analysis.comparison = generated.value;
    analysis.run = {
      ...(previousRun || generated.run),
      calls: [...(previousRun?.calls || []), ...(generated.run.calls || [])],
      usage: addUsage(previousRun?.usage, generated.run.usage),
      durationMs: (previousRun?.durationMs || 0) + (generated.run.durationMs || 0),
      completedAt: generated.run.completedAt,
    };
    await saveWritingAssessment({ userId: user.$id, taskId, prompt, essay, analysis });
    return NextResponse.json({ comparison: analysis.comparison, analysis });
  } catch (error: unknown) {
    if (error instanceof AssessmentAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AssessmentRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }
    console.error('Writing comparison error:', error);
    return NextResponse.json({ error: 'Comparison could not be generated.' }, { status: 500 });
  } finally {
    releaseSlot?.();
  }
}
