/**
 * Measure an assessment pipeline against real tutor-marked essays.
 *
 * The fixtures carry 666 tutor comments anchored to exact character spans in the
 * original essays (scripts/build-tutor-fixtures via tmp/corpus/fixtures.json).
 * A pipeline "recalls" a tutor comment when any finding it emits overlaps that
 * comment's span. Every prompt change should move these numbers; without them,
 * run-to-run variance is larger than the effect being measured.
 *
 * Usage:
 *   npx tsx scripts/eval-assessment-recall.ts --runs 3 --limit 10
 *   npx tsx scripts/eval-assessment-recall.ts --version v8 --runs 5 --out tmp/eval/v8.json
 *   npx tsx scripts/eval-assessment-recall.ts --baseline tmp/eval/v8.json --out tmp/eval/v9.json
 *
 * Requires the provider key the pipeline uses (GROK_API_KEY / DEEPSEEK_API_KEY /
 * MIMO_API_KEY) in .env.local. Behind an egress proxy, run with NODE_USE_ENV_PROXY=1.
 */
import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildEssayManifest } from '@/lib/writing-analysis-contract';
import {
  runWritingAssessmentPipelineV2,
  runWritingAssessmentPipelineV7,
  runWritingAssessmentPipelineV8,
} from '@/lib/writing-assessment-pipeline-v2';
import type { WritingAnalysis } from '@/types/writing';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const RUNS = Number(argValue('--runs') || 3);
const LIMIT = Number(argValue('--limit') || 0);
const VERSION = (argValue('--version') || 'v8').toLowerCase();
const OUT_PATH = argValue('--out');
const BASELINE_PATH = argValue('--baseline');
const FIXTURES_PATH = argValue('--fixtures') || 'tmp/corpus/fixtures.json';
const CONCURRENCY = Number(argValue('--concurrency') || 3);

const PIPELINES: Record<string, typeof runWritingAssessmentPipelineV8> = {
  v2: runWritingAssessmentPipelineV2,
  v7: runWritingAssessmentPipelineV7,
  v8: runWritingAssessmentPipelineV8,
};

interface Anchor {
  anchoredText: string;
  comment: string;
  criterion: string | null;
  startChar: number;
  endChar: number;
  resolved: boolean;
}
interface Fixture {
  fileId: string;
  docTitle: string;
  question: string;
  essay: string;
  anchors: Anchor[];
}
interface Span { startChar: number; endChar: number; criterion: string }

/** Every character span the analysis points at, tagged with the criterion that owns it. */
function findingSpans(analysis: WritingAnalysis): Span[] {
  const spans: Span[] = [];
  const push = (criterion: string, list?: Array<{ startChar?: number; endChar?: number }>) => {
    for (const item of list || []) {
      if (typeof item.startChar === 'number' && typeof item.endChar === 'number' && item.endChar > item.startChar) {
        spans.push({ startChar: item.startChar, endChar: item.endChar, criterion });
      }
    }
  };
  push('cohesion', analysis.cohesionHighlights);
  push('lexical_resource', analysis.lexicalHighlights);
  push('grammatical_range_accuracy', analysis.grammaticalHighlights);

  const nodes = [
    ...(analysis.pyramid.macroAnswer?.errors || []),
    ...analysis.pyramid.paragraphs.flatMap(paragraph => [
      ...(paragraph.errors || []),
      ...paragraph.sentences.flatMap(sentence => sentence.errors || []),
    ]),
  ];
  for (const error of nodes) {
    for (const span of error.evidenceSpans || []) {
      spans.push({ startChar: span.startChar, endChar: span.endChar, criterion: 'task_response' });
    }
  }
  // A coherence flow carries its spans on the nested issue, not on the flow itself.
  for (const flow of analysis.pyramid.coherenceFlows || []) {
    for (const span of flow.issue?.evidenceSpans || []) {
      spans.push({ startChar: span.startChar, endChar: span.endChar, criterion: 'coherence' });
    }
  }
  return spans;
}

function overlaps(a: Span, anchor: Anchor) {
  return a.startChar < anchor.endChar && anchor.startChar < a.endChar;
}

function summarize(values: number[]) {
  if (!values.length) return { mean: 0, min: 0, max: 0, sd: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { mean, min: Math.min(...values), max: Math.max(...values), sd };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

interface FixtureOutcome {
  fileId: string;
  docTitle: string;
  humanAnchors: number;
  runs: Array<{
    ok: boolean;
    error?: string;
    findings: number;
    recalled: number;
    byCriterion?: Record<string, { hit: number; total: number }>;
    findingsByCriterion?: Record<string, number>;
    scores?: WritingAnalysis['scores'];
  }>;
  missedAnchors: Array<{ anchoredText: string; comment: string }>;
}

async function main() {
  const runPipeline = PIPELINES[VERSION];
  if (!runPipeline) throw new Error(`Unknown pipeline version ${VERSION}. Known: ${Object.keys(PIPELINES).join(', ')}`);

  const raw = JSON.parse(await readFile(path.resolve(FIXTURES_PATH), 'utf8')) as Fixture[];
  let fixtures = raw.filter(f => f.question && f.anchors.filter(a => a.resolved).length >= 4);
  if (LIMIT) fixtures = fixtures.slice(0, LIMIT);
  console.log(`${fixtures.length} fixtures × ${RUNS} run(s) against ${VERSION}\n`);

  const outcomes = await mapWithConcurrency(fixtures, CONCURRENCY, async fixture => {
    const anchors = fixture.anchors.filter(a => a.resolved);
    const manifest = buildEssayManifest(fixture.essay);
    const outcome: FixtureOutcome = {
      fileId: fixture.fileId,
      docTitle: fixture.docTitle,
      humanAnchors: anchors.length,
      runs: [],
      missedAnchors: [],
    };
    const missedEveryRun = new Map(anchors.map(a => [a.anchoredText, a]));

    for (let run = 0; run < RUNS; run += 1) {
      try {
        const analysis = await runPipeline({ prompt: fixture.question, essay: fixture.essay, manifest });
        const spans = findingSpans(analysis);
        let recalled = 0;
        const byCriterion: Record<string, { hit: number; total: number }> = {};
        for (const anchor of anchors) {
          const key = anchor.criterion || 'unlabelled';
          byCriterion[key] ||= { hit: 0, total: 0 };
          byCriterion[key].total += 1;
          if (spans.some(span => overlaps(span, anchor))) {
            recalled += 1;
            byCriterion[key].hit += 1;
            missedEveryRun.delete(anchor.anchoredText);
          }
        }
        const findingsByCriterion: Record<string, number> = {};
        for (const span of spans) {
          findingsByCriterion[span.criterion] = (findingsByCriterion[span.criterion] || 0) + 1;
        }
        outcome.runs.push({
          ok: true,
          findings: spans.length,
          recalled,
          byCriterion,
          findingsByCriterion,
          scores: analysis.scores,
        });
      } catch (error) {
        outcome.runs.push({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          findings: 0,
          recalled: 0,
        });
      }
    }
    outcome.missedAnchors = [...missedEveryRun.values()]
      .map(a => ({ anchoredText: a.anchoredText, comment: a.comment }));
    console.log(
      `  ${outcome.docTitle.slice(0, 46).padEnd(48)} anchors=${String(outcome.humanAnchors).padStart(2)} `
      + `findings=${outcome.runs.map(r => r.findings).join('/')} `
      + `recall=${outcome.runs.map(r => (r.recalled / outcome.humanAnchors * 100).toFixed(0) + '%').join('/')}`,
    );
    return outcome;
  });

  const okRuns = outcomes.flatMap(o => o.runs.filter(r => r.ok));
  const totalAnchors = outcomes.reduce((sum, o) => sum + o.humanAnchors, 0);
  const recallPerRun = outcomes.flatMap(o => o.runs.filter(r => r.ok).map(r => r.recalled / o.humanAnchors));
  const findingsPerRun = okRuns.map(r => r.findings);
  // Stability: how much the finding count moves across runs of the SAME essay.
  const withinFixtureSpread = outcomes
    .map(o => o.runs.filter(r => r.ok).map(r => r.findings))
    .filter(counts => counts.length > 1)
    .map(counts => Math.max(...counts) - Math.min(...counts));

  const report = {
    version: VERSION,
    runs: RUNS,
    fixtures: outcomes.length,
    failedRuns: outcomes.flatMap(o => o.runs).filter(r => !r.ok).length,
    totalHumanAnchors: totalAnchors,
    recall: summarize(recallPerRun),
    findingsPerEssay: summarize(findingsPerRun),
    humanCommentsPerEssay: totalAnchors / Math.max(1, outcomes.length),
    withinFixtureFindingSpread: summarize(withinFixtureSpread),
    zeroFindingRuns: okRuns.filter(r => r.findings === 0).length,
    outcomes,
  };

  // Per-criterion recall is the view that matters: one blended number hides a
  // criterion that has gone silent behind three that are working.
  const criterionTotals: Record<string, { hit: number; total: number }> = {};
  const emitted: Record<string, number> = {};
  for (const outcome of outcomes) {
    for (const run of outcome.runs) {
      for (const [criterion, counts] of Object.entries(run.byCriterion || {})) {
        criterionTotals[criterion] ||= { hit: 0, total: 0 };
        criterionTotals[criterion].hit += counts.hit;
        criterionTotals[criterion].total += counts.total;
      }
      for (const [criterion, count] of Object.entries(run.findingsByCriterion || {})) {
        emitted[criterion] = (emitted[criterion] || 0) + count;
      }
    }
  }
  const emittedTotal = Object.values(emitted).reduce((sum, value) => sum + value, 0) || 1;
  const humanTotal = Object.values(criterionTotals).reduce((sum, value) => sum + value.total, 0) || 1;
  (report as Record<string, unknown>).perCriterion = Object.fromEntries(
    Object.entries(criterionTotals).map(([criterion, counts]) => [criterion, {
      recall: counts.hit / counts.total,
      humanShare: counts.total / humanTotal,
      modelShare: (emitted[criterion] || 0) / emittedTotal,
    }]),
  );

  console.log('\n──────── summary ────────');
  console.log(`recall           mean ${(report.recall.mean * 100).toFixed(1)}%  (min ${(report.recall.min * 100).toFixed(0)}%  max ${(report.recall.max * 100).toFixed(0)}%)`);
  console.log('\nper criterion      recall   human share   model share');
  for (const [criterion, counts] of Object.entries(criterionTotals).sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      `  ${criterion.padEnd(28)} ${(counts.hit / counts.total * 100).toFixed(0).padStart(4)}%   `
      + `${(counts.total / humanTotal * 100).toFixed(0).padStart(6)}%   `
      + `${((emitted[criterion] || 0) / emittedTotal * 100).toFixed(0).padStart(6)}%`,
    );
  }
  console.log(`findings/essay   mean ${report.findingsPerEssay.mean.toFixed(1)}  vs human ${report.humanCommentsPerEssay.toFixed(1)}`);
  console.log(`stability        same-essay finding-count spread mean ${report.withinFixtureFindingSpread.mean.toFixed(1)}`);
  console.log(`zero-finding runs ${report.zeroFindingRuns} / ${okRuns.length}`);
  console.log(`failed runs       ${report.failedRuns}`);

  if (BASELINE_PATH) {
    const baseline = JSON.parse(await readFile(path.resolve(BASELINE_PATH), 'utf8'));
    const delta = (report.recall.mean - baseline.recall.mean) * 100;
    console.log(`\nvs baseline ${baseline.version}: recall ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points, `
      + `findings/essay ${(report.findingsPerEssay.mean - baseline.findingsPerEssay.mean).toFixed(1)}`);
  }

  if (OUT_PATH) {
    const resolved = path.resolve(OUT_PATH);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote ${resolved}`);
  }
}

main().catch(error => {
  console.error('Eval failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
