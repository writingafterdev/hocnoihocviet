import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';

type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  costUsd: number;
  label: string;
};

async function main() {
const ROOT = resolve(process.cwd());
const args = new Map(
  process.argv.slice(2).flatMap((arg, index, allArgs) => {
    if (!arg.startsWith('--')) return [];
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    return [[key, inlineValue ?? allArgs[index + 1] ?? 'true']];
  }),
);
const SOURCES = (args.get('source') || 'tmp/benchmark-prompt-ab/v2.2.5-vs-v2.2.6-youpass-sample/results.json')
  .split(',')
  .map(item => resolve(ROOT, item.trim()))
  .filter(Boolean);
const PROMPT_VERSION = args.get('prompt-version') || process.env.ASSESSMENT_PROMPT_VERSION || 'v1-cleaned';
const ESSAY_COUNT = Number(args.get('essays') || '3');
const RUN_COUNT = Number(args.get('runs') || '3');
const TEMPERATURE = args.get('temperature') || '0';
const OFFSET = Number(args.get('offset') || '0');
const OUTPUT = args.get('output')
  ? resolve(ROOT, args.get('output') as string)
  : resolve(
      ROOT,
      `tmp/mimo-v8-consistency-${ESSAY_COUNT}x${RUN_COUNT}-offset-${OFFSET}-temperature-${TEMPERATURE}-${PROMPT_VERSION}.json`,
    );

config({ path: resolve(ROOT, '.env.local'), quiet: true });
if (!process.env.MIMO_API_KEY) throw new Error('MIMO_API_KEY is not configured.');

process.env.ASSESSMENT_LLM_PROVIDER = 'mimo';
process.env.ASSESSMENT_LLM_TEMPERATURE = TEMPERATURE;
process.env.ASSESSMENT_PROMPT_VERSION = PROMPT_VERSION;
process.env.MIMO_REASONING_ENABLED = 'false';
process.env.ASSESSMENT_BENCHMARK_MODE = 'true';
process.env.ASSESSMENT_BENCHMARK_MAX_USD ||= '0.6';
process.env.ASSESSMENT_LLM_TIMEOUT_MS = '60000';
process.env.ASSESSMENT_LLM_MAX_TOKENS = '8000';

const [{ buildEssayManifest }, { runWritingAssessmentPipelineV8 }] = await Promise.all([
  import('../src/lib/writing-analysis-contract'),
  import('../src/lib/writing-assessment-pipeline-v2'),
]);

type BenchmarkCase = {
  status?: string;
  externalOverall: string | number;
  sourceUrl: string;
  question: string;
  essay: string;
};

type SourcePayload = {
  results?: BenchmarkCase[];
} | BenchmarkCase | BenchmarkCase[] | Array<{
  caseId?: string;
  heading?: string;
  score?: { band?: number };
  externalScores?: { overall?: string | number };
  prompt?: string;
  question?: string;
  essay?: string;
  sourceUrl?: string;
  extractedTextPath?: string;
  readyForPromptComparison?: boolean;
}>;

async function normalizeSourceCases(source: SourcePayload, sourcePath: string): Promise<BenchmarkCase[]> {
  const rows = Array.isArray(source)
    ? source
    : 'results' in source && source.results
      ? source.results
      : [source];
  const normalized = await Promise.all(rows.map(async row => {
    if ('question' in row && 'essay' in row && row.question && row.essay) {
      return {
        status: row.status || 'complete',
        externalOverall: row.externalOverall || row.externalScores?.overall || 0,
        sourceUrl: row.sourceUrl || sourcePath,
        question: row.question,
        essay: row.essay,
      };
    }
    if ('prompt' in row && 'essay' in row && row.prompt && row.essay) {
      return {
        status: row.status || 'complete',
        externalOverall: row.externalOverall || row.externalScores?.overall || row.score || 0,
        sourceUrl: row.sourceUrl || sourcePath,
        question: row.prompt,
        essay: row.essay,
      };
    }
    if ('prompt' in row && row.prompt && row.extractedTextPath && row.score?.band) {
      if (row.readyForPromptComparison === false) return undefined;
      return {
        status: 'complete',
        externalOverall: row.score.band,
        sourceUrl: row.caseId || row.extractedTextPath,
        question: row.prompt,
        essay: await readFile(resolve(ROOT, row.extractedTextPath), 'utf8'),
      };
    }
    return undefined;
  }));
  return normalized.filter((row): row is BenchmarkCase => Boolean(row));
}

const sourceCases = (
  await Promise.all(SOURCES.map(async sourcePath => normalizeSourceCases(
    JSON.parse(await readFile(sourcePath, 'utf8')) as SourcePayload,
    sourcePath,
  )))
).flat();

const seen = new Set<string>();
const cases = sourceCases.filter(row => {
  if (row.status !== 'complete' || seen.has(row.sourceUrl)) return false;
  seen.add(row.sourceUrl);
  return true;
}).sort((left, right) => Number(left.externalOverall) - Number(right.externalOverall)).slice(OFFSET, OFFSET + ESSAY_COUNT);
if (cases.length !== ESSAY_COUNT) throw new Error(`Expected ${ESSAY_COUNT} unique cases, found ${cases.length}.`);

function allErrors(analysis: Awaited<ReturnType<typeof runWritingAssessmentPipelineV8>>) {
  return [
    ...(analysis.pyramid.macroAnswer.errors || []),
    ...analysis.pyramid.paragraphs.flatMap(paragraph => [
      ...(paragraph.errors || []),
      ...paragraph.sentences.flatMap(sentence => sentence.errors || []),
    ]),
  ];
}

function findingSignatures(analysis: Awaited<ReturnType<typeof runWritingAssessmentPipelineV8>>) {
  const normalize = (value: string) => value.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
  const signatures = [
    ...allErrors(analysis).map(error => (
      `task_response|${error.errorCode || ''}|${normalize(error.evidenceSpans?.[0]?.sourceText || error.message)}`
    )),
    ...(analysis.pyramid.edgeReviews || []).map(review => {
      const issue = review.issues[0];
      return `coherence|${issue?.errorCode || ''}|${normalize(issue?.evidenceSpans?.[0]?.sourceText || issue?.title || '')}`;
    }),
    ...analysis.cohesionHighlights.map(item => `cohesion|${item.errorCode || ''}|${normalize(item.sourceText || '')}`),
    ...analysis.lexicalHighlights.map(item => `lexical_resource|${item.errorCode || ''}|${normalize(item.sourceText || '')}`),
    ...analysis.grammaticalHighlights.map(item => `grammatical_range_accuracy|${item.errorCode || ''}|${normalize(item.sourceText || '')}`),
  ];
  return [...new Set(signatures)];
}

function evidenceSignatures(analysis: Awaited<ReturnType<typeof runWritingAssessmentPipelineV8>>) {
  const normalize = (value: string) => value.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
  const signatures = [
    ...allErrors(analysis).map(error => (
      `task_response|${normalize(error.evidenceSpans?.[0]?.sourceText || error.message)}`
    )),
    ...(analysis.pyramid.edgeReviews || []).map(review => {
      const issue = review.issues[0];
      return `coherence|${normalize(issue?.evidenceSpans?.[0]?.sourceText || issue?.title || '')}`;
    }),
    ...analysis.cohesionHighlights.map(item => `cohesion|${normalize(item.sourceText || '')}`),
    ...analysis.lexicalHighlights.map(item => `lexical_resource|${normalize(item.sourceText || '')}`),
    ...analysis.grammaticalHighlights.map(item => `grammatical_range_accuracy|${normalize(item.sourceText || '')}`),
  ];
  return [...new Set(signatures)];
}

const report: {
  createdAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  essayCount: number;
  runCount: number;
  offset: number;
  temperature: string;
  cases: Array<Record<string, unknown>>;
} = {
  createdAt: new Date().toISOString(),
  provider: 'mimo',
  model: process.env.MIMO_MODEL || 'mimo-v2.5',
  promptVersion: PROMPT_VERSION,
  essayCount: ESSAY_COUNT,
  runCount: RUN_COUNT,
  offset: OFFSET,
  temperature: TEMPERATURE,
  cases: [],
};

for (const [caseIndex, testCase] of cases.entries()) {
  const caseResult: {
    expectedOverall: number;
    sourceUrl: string;
    prompt: string;
    essay: string;
    runs: Array<Record<string, unknown>>;
  } = {
    expectedOverall: Number(testCase.externalOverall),
    sourceUrl: testCase.sourceUrl,
    prompt: testCase.question,
    essay: testCase.essay,
    runs: [],
  };
  report.cases.push(caseResult);

  for (let repetition = 1; repetition <= RUN_COUNT; repetition += 1) {
    const usage: Usage[] = [];
    const originalInfo = console.info;
    console.info = (...args: unknown[]) => {
      originalInfo(...args);
      if (args[0] !== '[assessment-llm-usage]' || typeof args[1] !== 'string') return;
      try {
        const parsed = JSON.parse(args[1]) as Usage;
        usage.push(parsed);
      } catch {
        // Preserve benchmark progress even if a diagnostic line changes shape.
      }
    };

    const startedAt = Date.now();
    try {
      const analysis = await runWritingAssessmentPipelineV8({
        prompt: testCase.question,
        essay: testCase.essay,
        manifest: buildEssayManifest(testCase.essay),
      });
      const candidateSignatures = (
        analysis as typeof analysis & { benchmarkCandidateSignatures?: string[] }
      ).benchmarkCandidateSignatures;
      const candidateSeveritySignatures = (
        analysis as typeof analysis & { benchmarkCandidateSeveritySignatures?: string[] }
      ).benchmarkCandidateSeveritySignatures;
      const candidateProblemStrengthSignatures = (
        analysis as typeof analysis & { benchmarkCandidateProblemStrengthSignatures?: string[] }
      ).benchmarkCandidateProblemStrengthSignatures;
      const errors = allErrors(analysis);
      caseResult.runs.push({
        repetition,
        status: 'complete',
        wallTimeMs: Date.now() - startedAt,
        usage: {
          requestCount: usage.length,
          promptTokens: usage.reduce((sum, item) => sum + item.promptTokens, 0),
          completionTokens: usage.reduce((sum, item) => sum + item.completionTokens, 0),
          totalTokens: usage.reduce((sum, item) => sum + item.totalTokens, 0),
          providerDurationMs: usage.reduce((sum, item) => sum + item.durationMs, 0),
          costUsd: usage.reduce((sum, item) => sum + Number(item.costUsd || 0), 0),
        },
        scores: analysis.scores,
        counts: {
          taskResponse: errors.length,
          coherence: analysis.pyramid.edgeReviews?.length || 0,
          cohesion: analysis.cohesionHighlights.length,
          lexicalResource: analysis.lexicalHighlights.length,
          grammar: analysis.grammaticalHighlights.length,
          total: findingSignatures(analysis).length,
        },
        findingSignatures: findingSignatures(analysis),
        evidenceSignatures: evidenceSignatures(analysis),
        candidateEvidenceSignatures: candidateSignatures,
        candidateSeverityEvidenceSignatures: candidateSeveritySignatures,
        candidateProblemStrengthEvidenceSignatures: candidateProblemStrengthSignatures,
      });
    } catch (error) {
      caseResult.runs.push({
        repetition,
        status: 'failed',
        wallTimeMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        usage: {
          requestCount: usage.length,
          promptTokens: usage.reduce((sum, item) => sum + item.promptTokens, 0),
          completionTokens: usage.reduce((sum, item) => sum + item.completionTokens, 0),
          totalTokens: usage.reduce((sum, item) => sum + item.totalTokens, 0),
          providerDurationMs: usage.reduce((sum, item) => sum + item.durationMs, 0),
          costUsd: usage.reduce((sum, item) => sum + Number(item.costUsd || 0), 0),
        },
      });
    } finally {
      console.info = originalInfo;
    }

    await writeFile(OUTPUT, JSON.stringify(report, null, 2), { mode: 0o600 });
    originalInfo('[consistency-progress]', JSON.stringify({
      case: caseIndex + 1,
      expectedOverall: testCase.externalOverall,
      repetition,
      status: caseResult.runs.at(-1)?.status,
    }));
  }
  await writeFile(OUTPUT, JSON.stringify(report, null, 2), { mode: 0o600 });
}

console.info('[consistency-complete]', OUTPUT);
}

main().catch(error => {
  console.error('[consistency-failed]', error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
