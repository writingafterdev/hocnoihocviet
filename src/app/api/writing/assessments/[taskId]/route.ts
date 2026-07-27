import { NextResponse } from 'next/server';
import { AssessmentAuthenticationError, requireAssessmentUser } from '@/lib/appwrite-auth-server';
import { alignWritingAnalysis, buildEssayManifest, validateWritingAnalysis } from '@/lib/writing-analysis-contract';
import { loadWritingAssessment } from '@/lib/writing-assessment-store';
import type { WritingAnalysis } from '@/types/writing';

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const user = await requireAssessmentUser(request);
    const document = await loadWritingAssessment(user.$id, taskId);
    const essay = String(document.essay || '');
    const manifest = buildEssayManifest(essay);
    const storedAnalysis = JSON.parse(String(document.analysis_json || 'null')) as WritingAnalysis;
    const analysis = alignWritingAnalysis(storedAnalysis, essay, manifest);
    const validationErrors = validateWritingAnalysis(analysis, manifest, essay);
    if (validationErrors.length) {
      return NextResponse.json(
        { error: 'Stored assessment is incompatible with the current review format.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      assessment: {
        taskId: document.task_id,
        prompt: document.prompt,
        essay,
        analysis,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AssessmentAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const status =
      typeof error === 'object' && error !== null && 'code' in error && error.code === 404
        ? 404
        : 500;
    return NextResponse.json(
      { error: status === 404 ? 'Assessment not found' : 'Failed to load assessment' },
      { status },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Assessments are persisted by the analysis service and cannot be supplied by the browser.' },
    { status: 405, headers: { Allow: 'GET' } },
  );
}
