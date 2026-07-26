import { NextRequest, NextResponse } from 'next/server';
import {
  buildEssayManifest,
} from '@/lib/writing-analysis-contract';
import {
  runWritingAssessmentPipelineV2,
  runWritingAssessmentPipelineV3,
  runWritingAssessmentPipelineV4,
  runWritingAssessmentPipelineV5,
  runWritingAssessmentPipelineV6,
  runWritingAssessmentPipelineV7,
  runWritingAssessmentPipelineV8,
} from '@/lib/writing-assessment-pipeline-v2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, essay } = body as { prompt: string; essay: string };

    if (!prompt || !essay) {
      return NextResponse.json({ error: 'Missing prompt or essay' }, { status: 400 });
    }

    if (essay.trim().split(/\s+/).length < 100) {
      return NextResponse.json({ error: 'Essay is too short. Please write at least 100 words.' }, { status: 400 });
    }

    const manifest = buildEssayManifest(essay);
    const pipelineVersion = process.env.ASSESSMENT_PIPELINE_VERSION?.toLowerCase() || 'v8';
    const runPipeline = pipelineVersion === 'v2'
      ? runWritingAssessmentPipelineV2
      : pipelineVersion === 'v7'
        ? runWritingAssessmentPipelineV7
      : pipelineVersion === 'v8'
        ? runWritingAssessmentPipelineV8
      : pipelineVersion === 'v6'
        ? runWritingAssessmentPipelineV6
      : pipelineVersion === 'v5'
        ? runWritingAssessmentPipelineV5
        : pipelineVersion === 'v4'
          ? runWritingAssessmentPipelineV4
          : runWritingAssessmentPipelineV3;
    const analysis = await runPipeline({ prompt, essay, manifest });

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    console.error('Writing analyze error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze writing' },
      { status: 500 },
    );
  }
}
