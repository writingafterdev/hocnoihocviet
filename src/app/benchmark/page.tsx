'use client';

import { useEffect, useMemo, useState } from 'react';

type JobStatus = 'queued' | 'running' | 'complete' | 'failed';
type ReviewVerdict = 'unreviewed' | 'useful' | 'needs_revision' | 'bad' | 'gold';

interface BenchmarkJob {
  id: string;
  benchmarkId: string;
  status: JobStatus;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  sourceUrl: string;
  scores: {
    overall?: string;
    taskResponse?: string;
    coherenceCohesion?: string;
    lexicalResource?: string;
    gra?: string;
  };
  question: string;
  essay: string;
  model: string;
  usage: unknown;
  durationMs: number;
  errorSummary: string;
  resultId: string;
}

interface BenchmarkResult {
  id: string;
  benchmarkId: string;
  assessmentMarkdown: string;
  filledPrompt: string;
  promptVersion: string;
  systemPromptSnapshot: string;
  userPromptSnapshot: string;
  createdAt: string;
}

interface FeedbackPoint {
  id: string;
  index: number;
  title: string;
  text: string;
}

interface FeedbackPointReview {
  pointId: string;
  verdict: ReviewVerdict;
  humanNote: string;
  externalNote: string;
}

interface BenchmarkReview {
  id?: string;
  benchmarkId?: string;
  jobId?: string;
  verdict: ReviewVerdict;
  missedIssues: string;
  wrongIssues: string;
  genericIssues: string;
  usefulNotes: string;
  actionItems: string;
  reviewerNotes: string;
  externalAuditNotes: string;
  synthesisNotes: string;
  promptAction: string;
  rootCause: string;
  priority: string;
  usableAsExample: string;
  refinedAssessmentMarkdown: string;
  refinedPrompt: string;
  refinedAt: string;
  refinedModel: string;
  refinedUsageJson: string;
  refinedDurationMs: number;
  pointReviews: FeedbackPointReview[];
  updatedAt?: string;
}

const emptyReview: BenchmarkReview = {
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

const verdictOptions: Array<{ value: ReviewVerdict; label: string }> = [
  { value: 'useful', label: 'Useful' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'bad', label: 'Bad' },
  { value: 'gold', label: 'Gold' },
];

function statusClasses(status: JobStatus) {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'running') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-zinc-200 bg-zinc-100 text-zinc-600';
}

function verdictClasses(verdict: ReviewVerdict, active = false) {
  const base = active ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/65 hover:border-black/25';
  if (!active) return base;
  if (verdict === 'gold') return 'border-amber-500 bg-amber-400 text-black';
  if (verdict === 'useful') return 'border-emerald-600 bg-emerald-600 text-white';
  if (verdict === 'needs_revision') return 'border-blue-600 bg-blue-600 text-white';
  if (verdict === 'bad') return 'border-red-600 bg-red-600 text-white';
  return base;
}

function formatDuration(ms: number) {
  if (!ms) return '-';
  return `${Math.round(ms / 1000)}s`;
}

function formatScores(job: BenchmarkJob) {
  return [
    `Overall ${job.scores.overall || '-'}`,
    `TR ${job.scores.taskResponse || '-'}`,
    `CC ${job.scores.coherenceCohesion || '-'}`,
    `LR ${job.scores.lexicalResource || '-'}`,
    `GRA ${job.scores.gra || '-'}`,
  ].join(' · ');
}

function normalizeReview(review: Partial<BenchmarkReview> | null | undefined): BenchmarkReview {
  return {
    ...emptyReview,
    ...(review || {}),
    pointReviews: Array.isArray(review?.pointReviews)
      ? review.pointReviews.map((point) => ({
        pointId: point.pointId,
        verdict: point.verdict || 'unreviewed',
        humanNote: point.humanNote || '',
        externalNote: point.externalNote || '',
      }))
      : [],
    externalAuditNotes: review?.externalAuditNotes || '',
    synthesisNotes: review?.synthesisNotes || '',
    promptAction: review?.promptAction || '',
    rootCause: review?.rootCause || '',
    priority: review?.priority || '',
    usableAsExample: review?.usableAsExample || '',
    refinedAssessmentMarkdown: review?.refinedAssessmentMarkdown || '',
    refinedPrompt: review?.refinedPrompt || '',
    refinedAt: review?.refinedAt || '',
    refinedModel: review?.refinedModel || '',
    refinedUsageJson: review?.refinedUsageJson || '',
    refinedDurationMs: typeof review?.refinedDurationMs === 'number' ? review.refinedDurationMs : 0,
  };
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cleanPointTitle(line: string, fallback: string) {
  const cleaned = line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*(?:point|finding|comment)\s*\d+\s*[:.\-—]?\s*/i, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/^\*\*(.*?)\*\*$/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
  return cleaned || fallback;
}

function firstMeaningfulLine(block: string) {
  return block.split('\n').map((line) => line.trim()).find(Boolean) || '';
}

function extractFeedbackPoints(markdown: string): FeedbackPoint[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (
      /^#{2,4}\s+\S/.test(line)
      || /^\s*(?:POINT|Point|Finding|Comment)\s+\d+\b/.test(line)
      || /^\s*\d+[.)]\s+\*\*[^*]+\*\*/.test(line)
    ) {
      starts.push(index);
    }
  });

  const blocks = starts.length >= 2
    ? starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length).join('\n').trim()).filter(Boolean)
    : trimmed.split(/\n{2,}/).map((block) => block.trim()).filter((block) => block.length >= 120);

  const usableBlocks = blocks.length ? blocks : [trimmed];
  return usableBlocks.map((block, index) => {
    const title = cleanPointTitle(firstMeaningfulLine(block), `Point ${index + 1}`);
    return {
      id: `point-${index + 1}-${simpleHash(block.slice(0, 240))}`,
      index: index + 1,
      title,
      text: block,
    };
  });
}

function getPointReview(review: BenchmarkReview, pointId: string): FeedbackPointReview {
  return review.pointReviews.find((item) => item.pointId === pointId) || {
    pointId,
    verdict: 'unreviewed',
    humanNote: '',
    externalNote: '',
  };
}

function buildExternalAuditPrompt(job: BenchmarkJob, result: BenchmarkResult | null) {
  return `You are a strict audit reviewer for an IELTS Writing Task 2 assessment system.

Be critical. Your job is to find where the model assessment is wrong, incomplete, generic, overconfident, misclassified, or too weak to explain the external score.

Do NOT just agree with the model output.
Do NOT rewrite the whole assessment unless needed.
Do NOT focus on politeness. Focus on correctness and usefulness.

Audit these layers:
1. Did the assessment catch the real errors that explain the external scores?
2. Did it miss any important Task Response, Coherence, Cohesion, Lexical Resource, or Grammar issue?
3. Did it invent false errors?
4. Did it classify an issue under the wrong criterion?
5. Did it over-explain obvious points or use generic wording?
6. Did the system prompt itself cause the weakness?

Return:

## Overall verdict
Useful / Needs revision / Bad / Gold

## Point-by-point audit
For each important point in the model output:
- verdict: useful / needs revision / bad / gold
- what is accurate
- what is missing or wrong
- exact revision instruction

## Missed errors
List any important errors the model failed to catch. Quote exact essay evidence.

## False positives / wrong category
List any issues the model should remove or reclassify.

## Prompt improvement notes
What should be changed in the system prompt or benchmark process because of this case?

EXAM QUESTION
${job.question}

STUDENT ESSAY
${job.essay}

EXTERNAL SCORES
${formatScores(job)}

SYSTEM PROMPT VERSION
${result?.promptVersion || 'unknown'}

SYSTEM PROMPT SNAPSHOT
${result?.systemPromptSnapshot || '[Legacy result: system prompt was not stored separately.]'}

USER PROMPT SNAPSHOT
${result?.userPromptSnapshot || result?.filledPrompt || '[No user prompt snapshot was found.]'}

MODEL OUTPUT TO AUDIT
${result?.assessmentMarkdown || '[No model output was found for this job.]'}`;
}

function ReviewNoteField(props: {
  label: string;
  value: string;
  placeholder: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black/35">
        {props.label}
      </span>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={props.rows || 3}
        className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-6 text-black/75 outline-none transition placeholder:text-black/25 focus:border-black/30"
      />
    </label>
  );
}

function ReviewSelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black/35">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/70 outline-none transition focus:border-black/30"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BenchmarkPage() {
  const [jobs, setJobs] = useState<BenchmarkJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BenchmarkJob | null>(null);
  const [selectedResult, setSelectedResult] = useState<BenchmarkResult | null>(null);
  const [selectedReview, setSelectedReview] = useState<BenchmarkReview>(emptyReview);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [analyzeMessage, setAnalyzeMessage] = useState('');
  const [refinePanelOpen, setRefinePanelOpen] = useState(true);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    return jobs.reduce<Record<JobStatus, number>>(
      (acc, job) => {
        acc[job.status] += 1;
        return acc;
      },
      { queued: 0, running: 0, complete: 0, failed: 0 },
    );
  }, [jobs]);

  const selectedIndex = useMemo(() => {
    if (!selectedJob) return -1;
    return jobs.findIndex((job) => job.id === selectedJob.id);
  }, [jobs, selectedJob]);

  const feedbackPoints = useMemo(() => {
    return extractFeedbackPoints(selectedResult?.assessmentMarkdown || '');
  }, [selectedResult]);

  const reviewedPointCount = useMemo(() => {
    return feedbackPoints.filter((point) => getPointReview(selectedReview, point.id).verdict !== 'unreviewed').length;
  }, [feedbackPoints, selectedReview]);

  async function loadJobs(options: { markLoading?: boolean; clearError?: boolean } = {}) {
    const { markLoading = true, clearError = true } = options;
    if (markLoading) setLoading(true);
    if (clearError) setError('');
    try {
      const response = await fetch('/api/benchmark/reference-assessments?limit=500', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not load benchmark jobs.');
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load benchmark jobs.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(job: BenchmarkJob) {
    setSelectedJob(job);
    setSelectedResult(null);
    setSelectedReview(emptyReview);
    setReviewMessage('');
    setRefinePanelOpen(true);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/benchmark/reference-assessments/${job.id}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not load benchmark job.');
      setSelectedJob(data.job);
      setSelectedResult(data.result);
      setSelectedReview(normalizeReview(data.review));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load benchmark job.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function persistReview(nextReview: BenchmarkReview, options: { advance?: boolean } = {}) {
    if (!selectedJob) return;

    const normalized = normalizeReview(nextReview);
    setSelectedReview(normalized);
    setReviewSaving(true);
    setReviewMessage('');
    setError('');
    try {
      const response = await fetch(`/api/benchmark/reference-assessments/${selectedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: normalized }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not save review.');
      setSelectedReview(normalizeReview(data.review || normalized));
      setReviewMessage('Saved');
      if (options.advance) {
        const next = jobs[selectedIndex + 1];
        if (next) void loadDetail(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review.');
    } finally {
      setReviewSaving(false);
    }
  }

  function updateReview<K extends keyof BenchmarkReview>(key: K, value: BenchmarkReview[K]) {
    setSelectedReview((current) => normalizeReview({ ...current, [key]: value }));
  }

  function updatePointReview(pointId: string, patch: Partial<FeedbackPointReview>, options: { save?: boolean } = {}) {
    const currentPointReview = getPointReview(selectedReview, pointId);
    const nextPointReview = { ...currentPointReview, ...patch, pointId };
    const otherPointReviews = selectedReview.pointReviews.filter((item) => item.pointId !== pointId);
    const nextReview = normalizeReview({
      ...selectedReview,
      pointReviews: [...otherPointReviews, nextPointReview],
    });
    setSelectedReview(nextReview);
    if (options.save) void persistReview(nextReview);
  }

  async function copyAuditPrompt() {
    if (!selectedJob) return;
    setReviewMessage('');
    try {
      await navigator.clipboard.writeText(buildExternalAuditPrompt(selectedJob, selectedResult));
      setReviewMessage('Audit prompt copied');
    } catch {
      setError('Could not copy audit prompt.');
    }
  }

  async function refineWithMimo() {
    if (!selectedJob) return;

    const normalized = normalizeReview(selectedReview);
    setSelectedReview(normalized);
    setRefining(true);
    setReviewMessage('');
    setError('');
    try {
      const response = await fetch(`/api/benchmark/reference-assessments/${selectedJob.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: normalized }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not refine assessment.');
      setSelectedReview(normalizeReview(data.review));
      setRefinePanelOpen(true);
      setReviewMessage('Refined with MiMo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refine assessment.');
    } finally {
      setRefining(false);
    }
  }

  async function diagnoseAudit() {
    if (!selectedJob) return;

    const normalized = normalizeReview(selectedReview);
    if (!normalized.externalAuditNotes.trim()) {
      setError('Paste the external AI audit first.');
      return;
    }

    setSelectedReview(normalized);
    setDiagnosing(true);
    setReviewMessage('');
    setError('');
    try {
      const response = await fetch(`/api/benchmark/reference-assessments/${selectedJob.id}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: normalized,
          feedbackPoints,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not diagnose external audit.');
      setSelectedReview(normalizeReview(data.review));
      setReviewMessage(`Audit diagnosed${data.durationMs ? ` · ${formatDuration(data.durationMs)}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not diagnose external audit.');
    } finally {
      setDiagnosing(false);
    }
  }

  async function analyzeAllJobs() {
    setAnalyzingAll(true);
    setAnalyzeMessage('');
    setError('');
    try {
      const response = await fetch('/api/benchmark/reference-assessments/analyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 500,
          concurrency: 3,
          includeFailed: true,
          rerunLegacy: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not analyze benchmark jobs.');
      setAnalyzeMessage(`Analyzed ${data.completed}/${data.candidates}${data.failed ? ` · ${data.failed} failed` : ''}`);
      await loadJobs({ markLoading: false });
      if (selectedJob) {
        const refreshedJob = jobs.find((job) => job.id === selectedJob.id) || selectedJob;
        await loadDetail(refreshedJob);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze benchmark jobs.');
    } finally {
      setAnalyzingAll(false);
    }
  }

  async function deleteAllJobs() {
    if (jobs.length === 0) return;
    const confirmed = window.confirm(`Delete all ${jobs.length} benchmark essays shown here? This also deletes their MiMo outputs and reviews.`);
    if (!confirmed) return;

    setDeletingAll(true);
    setAnalyzeMessage('');
    setReviewMessage('');
    setError('');
    try {
      const response = await fetch('/api/benchmark/reference-assessments?limit=500', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not delete benchmark jobs.');
      setSelectedJob(null);
      setSelectedResult(null);
      setSelectedReview(emptyReview);
      setAnalyzeMessage(`Deleted ${data.deleted}${data.skippedRunning ? ` · ${data.skippedRunning} running skipped` : ''}`);
      await loadJobs({ markLoading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete benchmark jobs.');
    } finally {
      setDeletingAll(false);
    }
  }

  function goToOffset(offset: number) {
    const next = jobs[selectedIndex + offset];
    if (next) void loadDetail(next);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJobs({ markLoading: false, clearError: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f6f4] px-5 py-5 text-[#141414]">
      <section className="mx-auto flex max-w-[1840px] flex-col gap-4">
        <header className="rounded-[26px] border border-black/10 bg-white px-6 py-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-black/35">
                Benchmark Review
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                Judge the points, not just the response
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['queued', 'running', 'complete', 'failed'] as JobStatus[]).map((status) => (
                <div key={status} className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
                    {status}
                  </span>
                  <span className="ml-2 text-sm font-semibold">{counts[status]}</span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => loadJobs()}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/65 transition hover:border-black/25"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={analyzeAllJobs}
                disabled={analyzingAll || deletingAll}
                className="rounded-full border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-wait disabled:border-black/25 disabled:bg-black/35"
              >
                {analyzingAll ? 'Analyzing all...' : 'Analyze all'}
              </button>
              <button
                type="button"
                onClick={deleteAllJobs}
                disabled={deletingAll || analyzingAll || jobs.length === 0}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingAll ? 'Deleting...' : 'Delete all'}
              </button>
              {analyzeMessage ? (
                <span className="text-xs font-semibold text-emerald-700">{analyzeMessage}</span>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid min-h-[calc(100vh-150px)] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[26px] border border-black/10 bg-white p-3 shadow-[0_18px_70px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-black/35">
                Queue
              </p>
              <p className="text-sm text-black/45">{loading ? 'Loading...' : `${jobs.length} jobs`}</p>
            </div>

            <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => loadDetail(job)}
                  className={`block w-full rounded-2xl border p-3 text-left transition hover:border-black/20 hover:bg-black/[0.015] ${
                    selectedJob?.id === job.id ? 'border-blue-300 bg-blue-50/70' : 'border-black/10 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-5">{job.question}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-black/45">{job.essay}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-black/35">
                    {formatScores(job)}
                  </p>
                </button>
              ))}

              {!loading && jobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/15 px-5 py-8 text-center text-sm text-black/45">
                  No imported essays yet.
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0 rounded-[26px] border border-black/10 bg-white shadow-[0_18px_70px_rgba(0,0,0,0.05)]">
            {selectedJob ? (
              <div className="flex h-full min-h-[calc(100vh-150px)] flex-col">
                <div className="sticky top-0 z-10 border-b border-black/10 bg-white/95 px-5 py-4 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-black/35">
                        {selectedIndex + 1 > 0 ? `${selectedIndex + 1} / ${jobs.length}` : 'Selected'} · {reviewedPointCount}/{feedbackPoints.length} points reviewed
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm font-semibold text-black/70">{selectedJob.question}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => goToOffset(-1)}
                        disabled={selectedIndex <= 0}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => goToOffset(1)}
                        disabled={selectedIndex < 0 || selectedIndex >= jobs.length - 1}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={copyAuditPrompt}
                        className="rounded-full border border-black/10 bg-[#f8f8f6] px-3 py-2 text-xs font-semibold text-black/65 transition hover:border-black/25"
                      >
                        Copy AI-audit prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => persistReview(selectedReview)}
                        disabled={reviewSaving || refining}
                        className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/35"
                      >
                        {reviewSaving ? 'Saving...' : 'Save review'}
                      </button>
                      <button
                        type="button"
                        onClick={refineWithMimo}
                        disabled={reviewSaving || refining || diagnosing || !selectedResult}
                        className="rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-blue-200 disabled:bg-blue-200"
                      >
                        {refining ? 'Refining...' : 'Save & Refine with MiMo'}
                      </button>
                      {reviewMessage ? <span className="text-xs font-semibold text-emerald-700">{reviewMessage}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(320px,0.86fr)_minmax(460px,1.14fr)]">
                  <section className="min-h-0 border-b border-black/10 lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
                        Essay + Scores
                      </p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(selectedJob.status)}`}>
                        {selectedJob.status}
                      </span>
                    </div>

                    <div className="max-h-[calc(100vh-250px)] overflow-y-auto px-6 py-5">
                      <div className="rounded-2xl border border-black/10 bg-[#fbfbfa] px-5 py-4">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black/35">
                          Question
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-black/75">{selectedJob.question}</p>
                        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-black/40">
                          {formatScores(selectedJob)}
                        </p>
                      </div>

                      <article className="mt-5 whitespace-pre-wrap font-serif text-[17px] leading-8 text-black/78">
                        {selectedJob.essay}
                      </article>

                      {selectedJob.errorSummary ? (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                          {selectedJob.errorSummary}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="min-h-0">
                    <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
                          External Audit + Feedback Points
                        </p>
                        <p className="mt-1 text-xs text-black/40">
                          {detailLoading ? 'Loading...' : selectedResult ? `${selectedJob.model || 'mimo'} · ${formatDuration(selectedJob.durationMs)}` : 'No output yet'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRefinePanelOpen((open) => !open)}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60 transition hover:border-black/25"
                      >
                        {refinePanelOpen ? 'Hide audit box' : 'Show audit box'}
                      </button>
                    </div>

                    {refinePanelOpen ? (
                      <div className="border-b border-black/10 bg-[#fbfbfa] px-5 py-4">
                        <div className="grid gap-3">
                          <ReviewNoteField
                            label="External AI Audit"
                            value={selectedReview.externalAuditNotes}
                            onChange={(value) => updateReview('externalAuditNotes', value)}
                            placeholder="Paste the full Claude/ChatGPT audit here. Keep it as one complete response."
                            rows={8}
                          />
                          <ReviewNoteField
                            label="Synthesis Notes"
                            value={selectedReview.synthesisNotes}
                            onChange={(value) => updateReview('synthesisNotes', value)}
                            placeholder="Optional: tell MiMo what to keep, remove, or revise before rerunning."
                            rows={4}
                          />
                          <div className="grid gap-3 md:grid-cols-4">
                            <ReviewSelectField
                              label="Root Cause"
                              value={selectedReview.rootCause}
                              onChange={(value) => updateReview('rootCause', value)}
                              options={[
                                { value: '', label: 'Not tagged' },
                                { value: 'prompt_gap', label: 'Prompt gap' },
                                { value: 'prompt_too_rigid', label: 'Prompt too rigid' },
                                { value: 'model_missed', label: 'Model missed' },
                                { value: 'model_overreached', label: 'Model overreached' },
                                { value: 'wrong_category', label: 'Wrong category' },
                                { value: 'ui_mapping_issue', label: 'UI/mapping issue' },
                              ]}
                            />
                            <ReviewSelectField
                              label="Prompt Action"
                              value={selectedReview.promptAction}
                              onChange={(value) => updateReview('promptAction', value)}
                              options={[
                                { value: '', label: 'No action yet' },
                                { value: 'add_rule', label: 'Add rule' },
                                { value: 'remove_rule', label: 'Remove rule' },
                                { value: 'simplify_rule', label: 'Simplify rule' },
                                { value: 'add_example', label: 'Add example' },
                                { value: 'change_order', label: 'Change order' },
                                { value: 'no_change', label: 'No prompt change' },
                              ]}
                            />
                            <ReviewSelectField
                              label="Priority"
                              value={selectedReview.priority}
                              onChange={(value) => updateReview('priority', value)}
                              options={[
                                { value: '', label: 'Unset' },
                                { value: 'high', label: 'High' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'low', label: 'Low' },
                              ]}
                            />
                            <ReviewSelectField
                              label="Example"
                              value={selectedReview.usableAsExample}
                              onChange={(value) => updateReview('usableAsExample', value)}
                              options={[
                                { value: '', label: 'Unset' },
                                { value: 'yes', label: 'Use as example' },
                                { value: 'no', label: 'Do not use' },
                                { value: 'maybe', label: 'Maybe' },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs leading-5 text-black/45">
                            Paste the outside audit, diagnose it into tags, then refine only after the diagnosis looks right.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={diagnoseAudit}
                              disabled={reviewSaving || refining || diagnosing || !selectedResult || !selectedReview.externalAuditNotes.trim()}
                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {diagnosing ? 'Diagnosing...' : 'Diagnose audit'}
                            </button>
                            <button
                              type="button"
                              onClick={refineWithMimo}
                              disabled={reviewSaving || refining || diagnosing || !selectedResult}
                              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/35"
                            >
                              {refining ? 'Refining with MiMo...' : 'Save & Refine'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-5">
                      {selectedResult ? (
                        <div className="space-y-4">
                          {selectedReview.refinedAssessmentMarkdown ? (
                            <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700/70">
                                    Refined Output
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-emerald-950">
                                    {selectedReview.refinedModel || 'MiMo'} · {selectedReview.refinedDurationMs ? formatDuration(selectedReview.refinedDurationMs) : 'saved'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setRefinePanelOpen(true)}
                                  className="rounded-full border border-emerald-700/20 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-700/40"
                                >
                                  Edit inputs
                                </button>
                              </div>
                              <pre className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm leading-7 text-black/75">
                                {selectedReview.refinedAssessmentMarkdown}
                              </pre>
                            </section>
                          ) : null}

                          {feedbackPoints.map((point) => {
                            const pointReview = getPointReview(selectedReview, point.id);
                            return (
                              <article key={point.id} className="rounded-3xl border border-black/10 bg-[#fbfbfa] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
                                      Point {point.index}
                                    </p>
                                    <h2 className="mt-1 line-clamp-2 text-base font-semibold tracking-[-0.02em] text-black/80">
                                      {point.title}
                                    </h2>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {verdictOptions.map((option) => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => updatePointReview(point.id, { verdict: option.value }, { save: true })}
                                        disabled={reviewSaving}
                                        className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-wait ${verdictClasses(
                                          option.value,
                                          pointReview.verdict === option.value,
                                        )}`}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <pre className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-black/10 bg-white p-4 text-sm leading-7 text-black/72">
                                  {point.text}
                                </pre>

                                <div className="mt-4">
                                  {pointReview.externalNote ? (
                                    <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950/75">
                                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700/70">
                                        Audit diagnosis
                                      </p>
                                      <p className="mt-1">{pointReview.externalNote}</p>
                                    </div>
                                  ) : null}
                                  <ReviewNoteField
                                    label="Your note"
                                    value={pointReview.humanNote}
                                    onChange={(value) => updatePointReview(point.id, { humanNote: value })}
                                    placeholder="Why this point is useful, wrong, too shallow, or needs revision."
                                    rows={3}
                                  />
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-black/15 px-6 py-10 text-sm leading-6 text-black/45">
                          {selectedJob.status === 'queued'
                            ? 'This essay is waiting for the worker.'
                            : selectedJob.status === 'running'
                              ? 'The worker is processing this essay.'
                              : selectedJob.status === 'failed'
                                ? 'This job failed. Check the error on the essay side.'
                                : 'No result document was found.'}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[calc(100vh-150px)] items-center justify-center px-8 text-center">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-black/35">
                    Review station
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-black/50">
                    Select a completed essay. Keep the essay on the left, inspect each feedback point on the right, then mark what is worth keeping.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
