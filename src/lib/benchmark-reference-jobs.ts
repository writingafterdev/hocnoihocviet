import { ID, Query } from 'appwrite';
import { createHash, randomUUID } from 'node:crypto';
import { serverDatabases } from '@/lib/appwrite-server';
import {
  BENCHMARK_REFERENCE_SYSTEM_PROMPT_VERSION,
  buildBenchmarkReferencePrompt,
  buildBenchmarkSystemPrompt,
  buildBenchmarkUserPrompt,
} from '@/lib/benchmark-reference-prompt';
import {
  BENCHMARK_POSTGEN_FILTER_VERSION,
  filterBenchmarkAssessmentMarkdown,
} from '@/lib/benchmark-postgen-filter';

export type BenchmarkJobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface ExternalScores {
  overall?: string;
  taskResponse?: string;
  coherenceCohesion?: string;
  lexicalResource?: string;
  gra?: string;
}

export interface BenchmarkReferenceJob {
  id: string;
  benchmarkId: string;
  status: BenchmarkJobStatus;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  source: string;
  sourceUrl: string;
  scores: ExternalScores;
  question: string;
  essay: string;
  provider: string;
  model: string;
  usage: unknown;
  durationMs: number;
  errorSummary: string;
  resultId: string;
}

export interface BenchmarkReferenceResult {
  id: string;
  benchmarkId: string;
  assessmentMarkdown: string;
  filledPrompt: string;
  promptVersion: string;
  systemPromptSnapshot: string;
  userPromptSnapshot: string;
  createdAt: string;
}

export type BenchmarkReviewVerdict = 'unreviewed' | 'useful' | 'needs_revision' | 'bad' | 'gold';

export interface BenchmarkPointReviewPayload {
  pointId: string;
  verdict?: BenchmarkReviewVerdict;
  humanNote?: string;
  externalNote?: string;
}

export interface BenchmarkReviewPayload {
  verdict?: BenchmarkReviewVerdict;
  missedIssues?: string;
  wrongIssues?: string;
  genericIssues?: string;
  usefulNotes?: string;
  actionItems?: string;
  reviewerNotes?: string;
  externalAuditNotes?: string;
  synthesisNotes?: string;
  promptAction?: string;
  rootCause?: string;
  priority?: string;
  usableAsExample?: string;
  refinedAssessmentMarkdown?: string;
  refinedPrompt?: string;
  refinedAt?: string;
  refinedModel?: string;
  refinedUsageJson?: string;
  refinedDurationMs?: number;
  pointReviews?: BenchmarkPointReviewPayload[];
}

export interface BenchmarkReferenceReview extends Required<BenchmarkReviewPayload> {
  id: string;
  benchmarkId: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
}

export const BENCHMARK_DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
export const BENCHMARK_JOBS_COLLECTION_ID =
  process.env.APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID
  || process.env.NEXT_PUBLIC_APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID
  || 'benchmark_reference_jobs';
export const BENCHMARK_RESULTS_COLLECTION_ID =
  process.env.APPWRITE_BENCHMARK_REFERENCE_RESULTS_COLLECTION_ID
  || process.env.NEXT_PUBLIC_APPWRITE_BENCHMARK_REFERENCE_RESULTS_COLLECTION_ID
  || 'benchmark_reference_results';
export const BENCHMARK_REVIEWS_COLLECTION_ID =
  process.env.APPWRITE_BENCHMARK_REFERENCE_REVIEWS_COLLECTION_ID
  || process.env.NEXT_PUBLIC_APPWRITE_BENCHMARK_REFERENCE_REVIEWS_COLLECTION_ID
  || 'benchmark_reference_reviews';
const BENCHMARK_REVIEW_ARTIFACT_CHUNK_SIZE = 24000;

type BenchmarkReviewArtifactKind = 'external_audit' | 'refined_assessment' | 'refined_prompt';

function scoresFromJson(value: unknown): ExternalScores {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as ExternalScores;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function jsonFromUnknown(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function docString(document: Record<string, unknown>, key: string) {
  const value = document[key];
  return typeof value === 'string' ? value : '';
}

function docNumber(document: Record<string, unknown>, key: string) {
  const value = document[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function chunkText(value: string, size = BENCHMARK_REVIEW_ARTIFACT_CHUNK_SIZE) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks.length ? chunks : [''];
}

function artifactJobId(jobId: string, kind: BenchmarkReviewArtifactKind) {
  return `${jobId}::artifact::${kind}`;
}

function artifactPayloadFromJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as {
      artifactKind?: BenchmarkReviewArtifactKind;
      sequence?: number;
      content?: string;
    };
    if (typeof parsed.content !== 'string' || typeof parsed.sequence !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function reviewPayloadFromJson(value: unknown): Required<BenchmarkReviewPayload> {
  const empty: Required<BenchmarkReviewPayload> = {
    verdict: 'unreviewed',
    missedIssues: '',
    wrongIssues: '',
    genericIssues: '',
    usefulNotes: '',
    actionItems: '',
    reviewerNotes: '',
    externalAuditNotes: '',
    synthesisNotes: '',
    promptAction: '',
    rootCause: '',
    priority: '',
    usableAsExample: '',
    refinedAssessmentMarkdown: '',
    refinedPrompt: '',
    refinedAt: '',
    refinedModel: '',
    refinedUsageJson: '',
    refinedDurationMs: 0,
    pointReviews: [],
  };
  if (typeof value !== 'string' || !value.trim()) return empty;
  try {
    const parsed = JSON.parse(value) as BenchmarkReviewPayload;
    const pointReviews = Array.isArray(parsed.pointReviews)
      ? parsed.pointReviews
        .filter((item) => item && typeof item.pointId === 'string')
        .map((item) => ({
          pointId: item.pointId,
          verdict: item.verdict || 'unreviewed',
          humanNote: item.humanNote || '',
          externalNote: item.externalNote || '',
        }))
      : [];
    return {
      verdict: parsed.verdict || empty.verdict,
      missedIssues: parsed.missedIssues || '',
      wrongIssues: parsed.wrongIssues || '',
      genericIssues: parsed.genericIssues || '',
      usefulNotes: parsed.usefulNotes || '',
      actionItems: parsed.actionItems || '',
      reviewerNotes: parsed.reviewerNotes || '',
      externalAuditNotes: parsed.externalAuditNotes || '',
      synthesisNotes: parsed.synthesisNotes || '',
      promptAction: parsed.promptAction || '',
      rootCause: parsed.rootCause || '',
      priority: parsed.priority || '',
      usableAsExample: parsed.usableAsExample || '',
      refinedAssessmentMarkdown: parsed.refinedAssessmentMarkdown || '',
      refinedPrompt: parsed.refinedPrompt || '',
      refinedAt: parsed.refinedAt || '',
      refinedModel: parsed.refinedModel || '',
      refinedUsageJson: parsed.refinedUsageJson || '',
      refinedDurationMs: typeof parsed.refinedDurationMs === 'number' ? parsed.refinedDurationMs : 0,
      pointReviews,
    };
  } catch {
    return empty;
  }
}

export function benchmarkJobFromDocument(document: Record<string, unknown>): BenchmarkReferenceJob {
  return {
    id: docString(document, '$id'),
    benchmarkId: docString(document, 'benchmark_id'),
    status: (docString(document, 'status') || 'queued') as BenchmarkJobStatus,
    createdAt: docString(document, 'created_at') || docString(document, '$createdAt'),
    startedAt: docString(document, 'started_at'),
    completedAt: docString(document, 'completed_at'),
    source: docString(document, 'source'),
    sourceUrl: docString(document, 'source_url'),
    scores: scoresFromJson(document.external_scores_json),
    question: docString(document, 'question'),
    essay: docString(document, 'essay'),
    provider: docString(document, 'provider'),
    model: docString(document, 'model'),
    usage: jsonFromUnknown(document.usage_json),
    durationMs: docNumber(document, 'duration_ms'),
    errorSummary: docString(document, 'error_summary'),
    resultId: docString(document, 'result_id'),
  };
}

export function benchmarkResultFromDocument(document: Record<string, unknown>): BenchmarkReferenceResult {
  const filledPrompt = docString(document, 'filled_prompt');
  const parsedPromptSnapshot = jsonFromUnknown(filledPrompt) as {
    promptVersion?: string;
    systemPromptSnapshot?: string;
    userPromptSnapshot?: string;
    filledPrompt?: string;
  } | null;
  const systemPromptSnapshot = parsedPromptSnapshot?.systemPromptSnapshot || '';
  const userPromptSnapshot = parsedPromptSnapshot?.userPromptSnapshot || filledPrompt;
  const reconstructedPrompt = systemPromptSnapshot && userPromptSnapshot
    ? `${systemPromptSnapshot}\n\n---\n\n${userPromptSnapshot}`
    : filledPrompt;

  return {
    id: docString(document, '$id'),
    benchmarkId: docString(document, 'benchmark_id'),
    assessmentMarkdown: docString(document, 'assessment_markdown'),
    filledPrompt: parsedPromptSnapshot?.filledPrompt || reconstructedPrompt,
    promptVersion: parsedPromptSnapshot?.promptVersion || 'legacy-blob',
    systemPromptSnapshot,
    userPromptSnapshot,
    createdAt: docString(document, 'created_at') || docString(document, '$createdAt'),
  };
}

export function benchmarkReviewFromDocument(document: Record<string, unknown>): BenchmarkReferenceReview {
  const payload = reviewPayloadFromJson(document.review_json);
  return {
    id: docString(document, '$id'),
    benchmarkId: docString(document, 'benchmark_id'),
    jobId: docString(document, 'job_id'),
    createdAt: docString(document, 'created_at') || docString(document, '$createdAt'),
    updatedAt: docString(document, 'updated_at') || docString(document, '$updatedAt'),
    ...payload,
  };
}

export function createBenchmarkId(question: string, essay: string) {
  const hash = createHash('sha256').update(question).update('\n---\n').update(essay).digest('hex').slice(0, 12);
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${hash}-${randomUUID().slice(0, 8)}`;
}

export async function enqueueBenchmarkReferenceJob(input: {
  question: string;
  essay: string;
  scores?: ExternalScores;
  sourceUrl?: string;
}) {
  if (!BENCHMARK_DATABASE_ID) throw new Error('Missing NEXT_PUBLIC_APPWRITE_DATABASE_ID.');

  const benchmarkId = createBenchmarkId(input.question, input.essay);
  const now = new Date().toISOString();
  const document = await serverDatabases.createDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_JOBS_COLLECTION_ID,
    ID.unique(),
    {
      benchmark_id: benchmarkId,
      status: 'queued',
      created_at: now,
      started_at: '',
      completed_at: '',
      source: 'youpass-extension',
      source_url: input.sourceUrl || '',
      external_scores_json: JSON.stringify(input.scores || {}),
      question: input.question,
      essay: input.essay,
      provider: 'mimo',
      model: '',
      usage_json: '{}',
      duration_ms: 0,
      error_summary: '',
      result_id: '',
    },
  );

  return benchmarkJobFromDocument(document as Record<string, unknown>);
}

export async function listBenchmarkReferenceJobs(limit = 50) {
  const jobs: BenchmarkReferenceJob[] = [];
  let cursor: string | null = null;

  while (jobs.length < limit) {
    const pageLimit = Math.min(100, limit - jobs.length);
    const queries: string[] = [
      Query.orderDesc('$createdAt'),
      Query.limit(pageLimit),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const response: { documents: Array<Record<string, unknown> & { $id: string }> } = await serverDatabases.listDocuments(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_JOBS_COLLECTION_ID,
      queries,
    );

    if (response.documents.length === 0) break;

    jobs.push(...response.documents.map((document) => benchmarkJobFromDocument(document as Record<string, unknown>)));
    cursor = response.documents[response.documents.length - 1].$id;

    if (response.documents.length < pageLimit) break;
  }

  return jobs;
}

export async function getBenchmarkReferenceJob(id: string) {
  const document = await serverDatabases.getDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_JOBS_COLLECTION_ID,
    id,
  );
  return benchmarkJobFromDocument(document as Record<string, unknown>);
}

async function deleteDocumentsByBenchmarkId(collectionId: string, benchmarkId: string) {
  let deleted = 0;

  while (true) {
    const response = await serverDatabases.listDocuments(
      BENCHMARK_DATABASE_ID,
      collectionId,
      [
        Query.equal('benchmark_id', benchmarkId),
        Query.limit(100),
      ],
    );

    if (response.documents.length === 0) return deleted;

    await Promise.all(response.documents.map((document) => serverDatabases.deleteDocument(
      BENCHMARK_DATABASE_ID,
      collectionId,
      document.$id,
    )));
    deleted += response.documents.length;
  }
}

export async function deleteBenchmarkReferenceJob(job: BenchmarkReferenceJob) {
  if (job.status === 'running') {
    throw new Error('Cannot delete a benchmark job while it is running.');
  }

  const [resultCount, reviewCount] = await Promise.all([
    deleteDocumentsByBenchmarkId(BENCHMARK_RESULTS_COLLECTION_ID, job.benchmarkId),
    deleteDocumentsByBenchmarkId(BENCHMARK_REVIEWS_COLLECTION_ID, job.benchmarkId),
  ]);

  await serverDatabases.deleteDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_JOBS_COLLECTION_ID,
    job.id,
  );

  return {
    jobId: job.id,
    benchmarkId: job.benchmarkId,
    deletedResults: resultCount,
    deletedReviews: reviewCount,
  };
}

export async function deleteBenchmarkReferenceJobs(limit = 100) {
  const jobs = await listBenchmarkReferenceJobs(limit);
  const deletableJobs = jobs.filter((job) => job.status !== 'running');
  const deleted = await Promise.all(deletableJobs.map((job) => deleteBenchmarkReferenceJob(job)));

  return {
    requested: jobs.length,
    deleted: deleted.length,
    skippedRunning: jobs.length - deletableJobs.length,
    details: deleted,
  };
}

export async function getBenchmarkReferenceResultByBenchmarkId(benchmarkId: string) {
  const response = await serverDatabases.listDocuments(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_RESULTS_COLLECTION_ID,
    [
      Query.equal('benchmark_id', benchmarkId),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ],
  );
  const document = response.documents[0];
  return document ? benchmarkResultFromDocument(document as Record<string, unknown>) : null;
}

export async function getBenchmarkReferenceReviewByJobId(jobId: string) {
  const response = await serverDatabases.listDocuments(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_REVIEWS_COLLECTION_ID,
    [
      Query.equal('job_id', jobId),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ],
  );
  const document = response.documents[0];
  if (!document) return null;

  const review = benchmarkReviewFromDocument(document as Record<string, unknown>);
  const [externalAuditNotes, refinedAssessmentMarkdown, refinedPrompt] = await Promise.all([
    getBenchmarkReferenceReviewArtifact(jobId, 'external_audit'),
    getBenchmarkReferenceReviewArtifact(jobId, 'refined_assessment'),
    getBenchmarkReferenceReviewArtifact(jobId, 'refined_prompt'),
  ]);

  return {
    ...review,
    externalAuditNotes: externalAuditNotes || review.externalAuditNotes,
    refinedAssessmentMarkdown: refinedAssessmentMarkdown || review.refinedAssessmentMarkdown,
    refinedPrompt: refinedPrompt || review.refinedPrompt,
  };
}

async function getBenchmarkReferenceReviewArtifact(jobId: string, kind: BenchmarkReviewArtifactKind) {
  const response = await serverDatabases.listDocuments(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_REVIEWS_COLLECTION_ID,
    [
      Query.equal('job_id', artifactJobId(jobId, kind)),
      Query.limit(100),
    ],
  );

  return response.documents
    .map((document) => artifactPayloadFromJson((document as Record<string, unknown>).review_json))
    .filter((payload): payload is {
      artifactKind?: BenchmarkReviewArtifactKind;
      sequence: number;
      content: string;
    } => Boolean(payload))
    .sort((a, b) => a.sequence - b.sequence)
    .map((payload) => payload.content)
    .join('');
}

async function replaceBenchmarkReferenceReviewArtifact(input: {
  jobId: string;
  benchmarkId: string;
  kind: BenchmarkReviewArtifactKind;
  content: string;
}) {
  const jobId = artifactJobId(input.jobId, input.kind);
  const existing = await serverDatabases.listDocuments(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_REVIEWS_COLLECTION_ID,
    [
      Query.equal('job_id', jobId),
      Query.limit(100),
    ],
  );

  await Promise.all(existing.documents.map((document) => serverDatabases.deleteDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_REVIEWS_COLLECTION_ID,
    document.$id,
  )));

  if (!input.content.trim()) return;

  const now = new Date().toISOString();
  await Promise.all(chunkText(input.content).map((content, sequence) => serverDatabases.createDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_REVIEWS_COLLECTION_ID,
    ID.unique(),
    {
      benchmark_id: input.benchmarkId,
      job_id: jobId,
      verdict: 'unreviewed',
      review_json: JSON.stringify({
        artifactKind: input.kind,
        sequence,
        content,
      }),
      created_at: now,
      updated_at: now,
    },
  )));
}

export async function upsertBenchmarkReferenceReview(input: {
  jobId: string;
  benchmarkId: string;
  review: BenchmarkReviewPayload;
}) {
  const now = new Date().toISOString();
  const existing = await getBenchmarkReferenceReviewByJobId(input.jobId);
  const existingMain = existing
    ? await serverDatabases.listDocuments(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_REVIEWS_COLLECTION_ID,
      [
        Query.equal('job_id', input.jobId),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ],
    )
    : null;
  const payload: Required<BenchmarkReviewPayload> = {
    verdict: input.review.verdict || 'unreviewed',
    missedIssues: input.review.missedIssues || '',
    wrongIssues: input.review.wrongIssues || '',
    genericIssues: input.review.genericIssues || '',
    usefulNotes: input.review.usefulNotes || '',
    actionItems: input.review.actionItems || '',
    reviewerNotes: input.review.reviewerNotes || '',
    externalAuditNotes: '',
    synthesisNotes: input.review.synthesisNotes || '',
    promptAction: input.review.promptAction || '',
    rootCause: input.review.rootCause || '',
    priority: input.review.priority || '',
    usableAsExample: input.review.usableAsExample || '',
    refinedAssessmentMarkdown: '',
    refinedPrompt: '',
    refinedAt: input.review.refinedAt || '',
    refinedModel: input.review.refinedModel || '',
    refinedUsageJson: input.review.refinedUsageJson || '',
    refinedDurationMs: typeof input.review.refinedDurationMs === 'number' ? input.review.refinedDurationMs : 0,
    pointReviews: Array.isArray(input.review.pointReviews)
      ? input.review.pointReviews
        .filter((item) => item && typeof item.pointId === 'string')
        .map((item) => ({
          pointId: item.pointId,
          verdict: item.verdict || 'unreviewed',
          humanNote: item.humanNote || '',
          externalNote: item.externalNote || '',
        }))
      : [],
  };
  const documentPayload = {
    benchmark_id: input.benchmarkId,
    job_id: input.jobId,
    verdict: payload.verdict,
    review_json: JSON.stringify(payload),
    updated_at: now,
    ...(existing ? {} : { created_at: now }),
  };

  const mainDocument = existingMain?.documents[0];
  if (mainDocument) {
    await serverDatabases.updateDocument(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_REVIEWS_COLLECTION_ID,
      mainDocument.$id,
      documentPayload,
    );
  } else {
    await serverDatabases.createDocument(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_REVIEWS_COLLECTION_ID,
      ID.unique(),
      documentPayload,
    );
  }

  await Promise.all([
    replaceBenchmarkReferenceReviewArtifact({
      jobId: input.jobId,
      benchmarkId: input.benchmarkId,
      kind: 'external_audit',
      content: input.review.externalAuditNotes || '',
    }),
    replaceBenchmarkReferenceReviewArtifact({
      jobId: input.jobId,
      benchmarkId: input.benchmarkId,
      kind: 'refined_assessment',
      content: input.review.refinedAssessmentMarkdown || '',
    }),
    replaceBenchmarkReferenceReviewArtifact({
      jobId: input.jobId,
      benchmarkId: input.benchmarkId,
      kind: 'refined_prompt',
      content: input.review.refinedPrompt || '',
    }),
  ]);

  return getBenchmarkReferenceReviewByJobId(input.jobId);
}

export async function getNextQueuedBenchmarkReferenceJob() {
  const response = await serverDatabases.listDocuments(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_JOBS_COLLECTION_ID,
    [
      Query.equal('status', 'queued'),
      Query.orderAsc('$createdAt'),
      Query.limit(1),
    ],
  );
  const document = response.documents[0];
  return document ? benchmarkJobFromDocument(document as Record<string, unknown>) : null;
}

export async function callMimoMarkdown(prompt: string) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error('Missing MIMO_API_KEY environment variable.');

  const model = process.env.MIMO_MODEL || 'mimo-v2.5';
  const baseUrl = (process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '');
  const maxTokens = Number(process.env.BENCHMARK_REFERENCE_MAX_TOKENS || process.env.ASSESSMENT_LLM_MAX_TOKENS || 16000);
  const timeoutMs = Number(process.env.BENCHMARK_REFERENCE_TIMEOUT_MS || process.env.ASSESSMENT_LLM_TIMEOUT_MS || 240000);

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: Number(process.env.BENCHMARK_REFERENCE_TEMPERATURE || 0.35),
      max_completion_tokens: maxTokens,
      ...(process.env.MIMO_REASONING_ENABLED === 'true'
        ? { thinking: { type: 'enabled' } }
        : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).error?.message || text;
    } catch {
      // Preserve the provider's original non-JSON error text.
    }
    throw new Error(`MiMo API Error: ${response.status} - ${message}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('MiMo did not return message content.');
  }
  if (/request was rejected|considered high risk/i.test(content)) {
    throw new Error(`MiMo refused benchmark request: ${content.trim().slice(0, 500)}`);
  }

  return {
    model,
    content: content.trim(),
    usage: data?.usage || null,
    durationMs: Date.now() - startedAt,
  };
}

export async function processBenchmarkReferenceJob(job: BenchmarkReferenceJob) {
  const startedAt = new Date().toISOString();
  await serverDatabases.updateDocument(
    BENCHMARK_DATABASE_ID,
    BENCHMARK_JOBS_COLLECTION_ID,
    job.id,
    {
      status: 'running',
      started_at: startedAt,
      error_summary: '',
    },
  );

  const promptInput = {
    question: job.question,
    essay: job.essay,
    scores: job.scores,
    sourceUrl: job.sourceUrl,
  };
  const systemPromptSnapshot = buildBenchmarkSystemPrompt();
  const userPromptSnapshot = buildBenchmarkUserPrompt(promptInput);
  const filledPrompt = buildBenchmarkReferencePrompt(promptInput);

  try {
    const result = await callMimoMarkdown(filledPrompt);
    const filtered = filterBenchmarkAssessmentMarkdown({
      markdown: result.content,
      essay: job.essay,
      scores: job.scores,
    });
    const resultDocument = await serverDatabases.createDocument(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_RESULTS_COLLECTION_ID,
      ID.unique(),
      {
        benchmark_id: job.benchmarkId,
        assessment_markdown: filtered.markdown,
        filled_prompt: JSON.stringify({
          promptVersion: BENCHMARK_REFERENCE_SYSTEM_PROMPT_VERSION,
          systemPromptSnapshot,
          userPromptSnapshot,
          postGenerationFilterVersion: BENCHMARK_POSTGEN_FILTER_VERSION,
          postGenerationFilterAudit: filtered.audit,
        }),
        created_at: new Date().toISOString(),
      },
    );

    await serverDatabases.updateDocument(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_JOBS_COLLECTION_ID,
      job.id,
      {
        status: 'complete',
        completed_at: new Date().toISOString(),
        model: result.model,
        usage_json: JSON.stringify(result.usage || {}),
        duration_ms: result.durationMs,
        result_id: resultDocument.$id,
      },
    );

    return {
      status: 'complete' as const,
      jobId: job.id,
      benchmarkId: job.benchmarkId,
      resultId: resultDocument.$id,
      durationMs: result.durationMs,
      usage: result.usage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown benchmark worker error.';
    await serverDatabases.updateDocument(
      BENCHMARK_DATABASE_ID,
      BENCHMARK_JOBS_COLLECTION_ID,
      job.id,
      {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_summary: message.slice(0, 2000),
      },
    );
    throw error;
  }
}
