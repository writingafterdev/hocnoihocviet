import { NextResponse } from 'next/server';
import {
  callMimoMarkdown,
  getBenchmarkReferenceJob,
  getBenchmarkReferenceResultByBenchmarkId,
  upsertBenchmarkReferenceReview,
  type BenchmarkPointReviewPayload,
  type BenchmarkReferenceJob,
  type BenchmarkReferenceResult,
  type BenchmarkReviewPayload,
} from '@/lib/benchmark-reference-jobs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function formatScores(job: BenchmarkReferenceJob) {
  return [
    `Overall ${job.scores.overall || '-'}`,
    `TR ${job.scores.taskResponse || '-'}`,
    `CC ${job.scores.coherenceCohesion || '-'}`,
    `LR ${job.scores.lexicalResource || '-'}`,
    `GRA ${job.scores.gra || '-'}`,
  ].join(' · ');
}

function formatPointReviews(pointReviews: BenchmarkPointReviewPayload[] | undefined) {
  if (!pointReviews?.length) return '[No point-level human review was provided.]';

  return pointReviews
    .map((point, index) => {
      return [
        `Point review ${index + 1}`,
        `pointId: ${point.pointId}`,
        `verdict: ${point.verdict || 'unreviewed'}`,
        point.humanNote ? `human note: ${point.humanNote}` : 'human note: [empty]',
      ].join('\n');
    })
    .join('\n\n');
}

function buildRefinementPrompt(input: {
  job: BenchmarkReferenceJob;
  result: BenchmarkReferenceResult;
  review: BenchmarkReviewPayload;
}) {
  return `You are refining an IELTS Writing Task 2 assessment after human review and optional external AI audit.

Your task:
- Keep the original assessment logic where it is accurate.
- Remove or rewrite feedback points marked bad or needs_revision.
- Preserve feedback points marked useful or gold, but make them clearer if needed.
- Use the external AI audit as a critique, not as unquestioned truth.
- Pay attention to whether the original system prompt caused the mistake.
- Do not invent errors to make the output longer.
- Do not over-explain. Keep the feedback direct, specific, and useful for a student.
- Keep comments friendly and human in Vietnamese, but keep exact essay evidence in English.
- If the original assessment missed an important issue confirmed by the human/external notes, add it.

Return the refined assessment only. Do not explain your process.

EXAM QUESTION
${input.job.question}

STUDENT ESSAY
${input.job.essay}

EXTERNAL SCORES
${formatScores(input.job)}

SYSTEM PROMPT VERSION
${input.result.promptVersion || 'unknown'}

SYSTEM PROMPT SNAPSHOT
${input.result.systemPromptSnapshot || '[Legacy result: system prompt was not stored separately.]'}

USER PROMPT SNAPSHOT
${input.result.userPromptSnapshot || input.result.filledPrompt}

ORIGINAL MIMO ASSESSMENT
${input.result.assessmentMarkdown}

HUMAN POINT-LEVEL REVIEW
${formatPointReviews(input.review.pointReviews)}

HUMAN SYNTHESIS NOTES
${input.review.synthesisNotes || '[empty]'}

PROMPT REFINEMENT TAGS
rootCause: ${input.review.rootCause || 'not tagged'}
promptAction: ${input.review.promptAction || 'not tagged'}
priority: ${input.review.priority || 'not tagged'}
usableAsExample: ${input.review.usableAsExample || 'not tagged'}

EXTERNAL AI AUDIT
${input.review.externalAuditNotes || '[empty]'}`;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const job = await getBenchmarkReferenceJob(id);
    const result = await getBenchmarkReferenceResultByBenchmarkId(job.benchmarkId);
    if (!result) {
      return NextResponse.json(
        { error: 'No MiMo result was found for this benchmark job.' },
        { status: 400 },
      );
    }

    const body = await request.json() as { review?: BenchmarkReviewPayload };
    const currentReview = body.review || {};
    const refinementPrompt = buildRefinementPrompt({ job, result, review: currentReview });
    const refined = await callMimoMarkdown(refinementPrompt);

    const review = await upsertBenchmarkReferenceReview({
      jobId: job.id,
      benchmarkId: job.benchmarkId,
      review: {
        ...currentReview,
        refinedAssessmentMarkdown: refined.content,
        refinedPrompt: refinementPrompt,
        refinedAt: new Date().toISOString(),
        refinedModel: refined.model,
        refinedUsageJson: JSON.stringify(refined.usage || {}),
        refinedDurationMs: refined.durationMs,
      },
    });

    return NextResponse.json({ job, result, review });
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'code' in error && error.code === 404
        ? 404
        : 500;
    return NextResponse.json(
      {
        error: status === 404
          ? 'Benchmark job not found.'
          : error instanceof Error
            ? error.message
            : 'Failed to refine benchmark assessment.',
      },
      { status },
    );
  }
}
