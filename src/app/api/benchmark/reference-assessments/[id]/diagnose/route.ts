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
  type BenchmarkReviewVerdict,
} from '@/lib/benchmark-reference-jobs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

interface FeedbackPointInput {
  id: string;
  index: number;
  title: string;
  text: string;
}

interface DiagnoseRequest {
  review?: BenchmarkReviewPayload;
  feedbackPoints?: FeedbackPointInput[];
}

type DiagnosisPayload = BenchmarkReviewPayload & {
  overallReason?: string;
  pointReviews?: BenchmarkPointReviewPayload[];
};

const verdicts = new Set<BenchmarkReviewVerdict>(['unreviewed', 'useful', 'needs_revision', 'bad', 'gold']);
const rootCauses = new Set(['', 'prompt_gap', 'prompt_too_rigid', 'model_missed', 'model_overreached', 'wrong_category', 'ui_mapping_issue']);
const promptActions = new Set(['', 'add_rule', 'remove_rule', 'simplify_rule', 'add_example', 'change_order', 'no_change']);
const priorities = new Set(['', 'high', 'medium', 'low']);
const exampleFlags = new Set(['', 'yes', 'no', 'maybe']);

function formatScores(job: BenchmarkReferenceJob) {
  return [
    `Overall ${job.scores.overall || '-'}`,
    `TR ${job.scores.taskResponse || '-'}`,
    `CC ${job.scores.coherenceCohesion || '-'}`,
    `LR ${job.scores.lexicalResource || '-'}`,
    `GRA ${job.scores.gra || '-'}`,
  ].join(' · ');
}

function formatFeedbackPoints(points: FeedbackPointInput[]) {
  if (!points.length) return '[No extracted feedback points were provided.]';
  return points
    .map((point) => [
      `POINT ${point.index}`,
      `pointId: ${point.id}`,
      `title: ${point.title}`,
      `text:`,
      point.text,
    ].join('\n'))
    .join('\n\n---\n\n');
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Diagnosis response did not contain a JSON object.');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as DiagnosisPayload;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function enumValue(value: unknown, allowed: Set<string>) {
  const text = stringValue(value);
  return allowed.has(text) ? text : '';
}

function verdictValue(value: unknown): BenchmarkReviewVerdict {
  const text = stringValue(value) as BenchmarkReviewVerdict;
  return verdicts.has(text) ? text : 'unreviewed';
}

function sanitizeDiagnosisPayload(payload: DiagnosisPayload, feedbackPoints: FeedbackPointInput[]) {
  const pointIds = new Set(feedbackPoints.map((point) => point.id));
  const pointReviews = Array.isArray(payload.pointReviews)
    ? payload.pointReviews
      .filter((point) => point && typeof point.pointId === 'string' && pointIds.has(point.pointId))
      .map((point) => ({
        pointId: point.pointId,
        verdict: verdictValue(point.verdict),
        humanNote: stringValue(point.humanNote),
        externalNote: stringValue(point.externalNote),
      }))
    : [];

  return {
    verdict: verdictValue(payload.verdict),
    missedIssues: stringValue(payload.missedIssues),
    wrongIssues: stringValue(payload.wrongIssues),
    genericIssues: stringValue(payload.genericIssues),
    usefulNotes: stringValue(payload.usefulNotes),
    actionItems: stringValue(payload.actionItems),
    reviewerNotes: stringValue(payload.reviewerNotes || payload.overallReason),
    synthesisNotes: stringValue(payload.synthesisNotes),
    rootCause: enumValue(payload.rootCause, rootCauses),
    promptAction: enumValue(payload.promptAction, promptActions),
    priority: enumValue(payload.priority, priorities),
    usableAsExample: enumValue(payload.usableAsExample, exampleFlags),
    pointReviews,
  } satisfies BenchmarkReviewPayload;
}

function mergePointReviews(
  current: BenchmarkPointReviewPayload[] | undefined,
  diagnosed: BenchmarkPointReviewPayload[] | undefined,
) {
  const merged = new Map<string, BenchmarkPointReviewPayload>();
  (current || []).forEach((point) => {
    if (point?.pointId) merged.set(point.pointId, point);
  });
  (diagnosed || []).forEach((point) => {
    if (!point?.pointId) return;
    const existing = merged.get(point.pointId);
    merged.set(point.pointId, {
      ...existing,
      ...point,
      humanNote: existing?.humanNote || point.humanNote || '',
      externalNote: point.externalNote || existing?.externalNote || '',
    });
  });
  return Array.from(merged.values());
}

function buildDiagnosisPrompt(input: {
  job: BenchmarkReferenceJob;
  result: BenchmarkReferenceResult;
  review: BenchmarkReviewPayload;
  feedbackPoints: FeedbackPointInput[];
}) {
  return `You are diagnosing weaknesses in an IELTS Writing Task 2 assessment system.

You are NOT reassessing the essay from scratch.
You are comparing:
1. the original MiMo assessment,
2. the external AI audit pasted by the human,
3. the external score,
4. the stored system prompt snapshot,
5. the extracted feedback points from the MiMo output.

Goal:
Convert the external audit into structured benchmark-review data that helps us improve the system prompt later.

Be critical. Identify what the original system likely missed, overreached on, misclassified, or made too generic.
Use the external audit as evidence, but do not accept it blindly.
If the external audit is weak, say that too.

Important:
- Keep exact essay evidence in English.
- Write explanations in Vietnamese where useful.
- Do not produce a new student-facing assessment.
- Do not suggest prompt changes from one tiny issue unless it reveals a reusable pattern.
- Point reviews must use the exact pointId values supplied below.

Allowed verdict values:
unreviewed, useful, needs_revision, bad, gold

Allowed rootCause values:
prompt_gap, prompt_too_rigid, model_missed, model_overreached, wrong_category, ui_mapping_issue

Allowed promptAction values:
add_rule, remove_rule, simplify_rule, add_example, change_order, no_change

Allowed priority values:
high, medium, low

Allowed usableAsExample values:
yes, no, maybe

Return ONLY valid JSON. No markdown.

JSON shape:
{
  "verdict": "useful | needs_revision | bad | gold | unreviewed",
  "overallReason": "short diagnosis of the original MiMo output",
  "missedIssues": "important issues MiMo missed",
  "wrongIssues": "false positives or wrong-category issues",
  "genericIssues": "where MiMo sounded generic, robotic, too academic, or not evidence-led",
  "usefulNotes": "what MiMo got right and should preserve",
  "actionItems": "concrete next prompt/process actions",
  "synthesisNotes": "what MiMo should do if asked to refine this assessment",
  "rootCause": "one allowed rootCause",
  "promptAction": "one allowed promptAction",
  "priority": "one allowed priority",
  "usableAsExample": "one allowed usableAsExample",
  "pointReviews": [
    {
      "pointId": "exact supplied pointId",
      "verdict": "useful | needs_revision | bad | gold | unreviewed",
      "externalNote": "short reason based on the external audit"
    }
  ]
}

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

EXTRACTED MIMO FEEDBACK POINTS
${formatFeedbackPoints(input.feedbackPoints)}

EXTERNAL AI AUDIT PASTED BY HUMAN
${input.review.externalAuditNotes || '[empty]'}

HUMAN SYNTHESIS NOTES
${input.review.synthesisNotes || '[empty]'}`;
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

    const body = await request.json() as DiagnoseRequest;
    const currentReview = body.review || {};
    if (!currentReview.externalAuditNotes?.trim()) {
      return NextResponse.json(
        { error: 'Paste an external AI audit before running diagnosis.' },
        { status: 400 },
      );
    }

    const feedbackPoints = Array.isArray(body.feedbackPoints) ? body.feedbackPoints : [];
    const diagnosisPrompt = buildDiagnosisPrompt({
      job,
      result,
      review: currentReview,
      feedbackPoints,
    });
    const diagnosis = await callMimoMarkdown(diagnosisPrompt);
    const sanitized = sanitizeDiagnosisPayload(extractJsonObject(diagnosis.content), feedbackPoints);

    const review = await upsertBenchmarkReferenceReview({
      jobId: job.id,
      benchmarkId: job.benchmarkId,
      review: {
        ...currentReview,
        ...sanitized,
        externalAuditNotes: currentReview.externalAuditNotes,
        pointReviews: mergePointReviews(currentReview.pointReviews, sanitized.pointReviews),
      },
    });

    return NextResponse.json({
      job,
      result,
      review,
      diagnosis: sanitized,
      model: diagnosis.model,
      usage: diagnosis.usage,
      durationMs: diagnosis.durationMs,
    });
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
            : 'Failed to diagnose benchmark audit.',
      },
      { status },
    );
  }
}
