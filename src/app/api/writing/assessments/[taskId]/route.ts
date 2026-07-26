import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID } from '@/lib/appwrite';
import { WRITING_ASSESSMENTS_COLLECTION_ID } from '@/lib/writing-assessments';
import type { WritingAnalysis } from '@/types/writing';
import {
  alignWritingAnalysis,
  buildEssayManifest,
  validateWritingAnalysis,
} from '@/lib/writing-analysis-contract';

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const document = await serverDatabases.getDocument(
      DB_ID,
      WRITING_ASSESSMENTS_COLLECTION_ID,
      taskId,
    );

    const essay = String(document.essay || '');
    const manifest = buildEssayManifest(essay);
    const storedAnalysis = JSON.parse(document.analysis_json) as WritingAnalysis;
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

export async function POST(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const body = await request.json() as {
      prompt?: string;
      essay?: string;
      analysis?: WritingAnalysis;
    };

    if (!body.prompt || !body.essay || !body.analysis) {
      return NextResponse.json({ error: 'Missing prompt, essay, or analysis.' }, { status: 400 });
    }

    const manifest = buildEssayManifest(body.essay);
    const analysis = alignWritingAnalysis(body.analysis, body.essay, manifest);
    const validationErrors = validateWritingAnalysis(analysis, manifest, body.essay);
    if (validationErrors.length) {
      return NextResponse.json(
        { error: 'Assessment does not match the submitted essay.', details: validationErrors },
        { status: 400 },
      );
    }

    const data = {
      task_id: taskId,
      label: taskId,
      prompt: body.prompt,
      essay: body.essay,
      analysis_json: JSON.stringify(analysis),
      state: 'complete',
    };

    try {
      await serverDatabases.updateDocument(
        DB_ID,
        WRITING_ASSESSMENTS_COLLECTION_ID,
        taskId,
        data,
      );
    } catch (error: unknown) {
      const isNotFound = typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
      if (!isNotFound) throw error;
      await serverDatabases.createDocument(
        DB_ID,
        WRITING_ASSESSMENTS_COLLECTION_ID,
        taskId,
        data,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Writing assessment save error:', error);
    return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 });
  }
}
