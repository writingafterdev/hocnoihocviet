/**
 * Score generated reference assessments against real human examiner bands.
 *
 * Joins Benchmark Reference Results to their Jobs and compares the bands the
 * model wrote to the external human scores the essay arrived with. Reports
 * agreement, per-criterion agreement, and — the number that matters most — the
 * bias curve across human band, which exposes regression to the mean.
 *
 * Run this after every reference-prompt change to see whether the curve
 * flattened. A single aggregate agreement figure hides the defect entirely:
 * over-scoring weak essays and under-scoring strong ones cancels out in the mean.
 *
 * Usage:
 *   npx tsx scripts/analyze-benchmark-calibration.ts
 *   npx tsx scripts/analyze-benchmark-calibration.ts --out tmp/eval/calibration.json
 *   npx tsx scripts/analyze-benchmark-calibration.ts --baseline tmp/eval/calibration.json
 *
 * Reads NEXT_PUBLIC_APPWRITE_* and APPWRITE_API_KEY from .env.local.
 * Behind an egress proxy, run with NODE_USE_ENV_PROXY=1.
 */
import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const OUT_PATH = argValue('--out');
const BASELINE_PATH = argValue('--baseline');
const ENDPOINT = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const JOBS = process.env.APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID || 'benchmark_reference_jobs';
const RESULTS = process.env.APPWRITE_BENCHMARK_REFERENCE_RESULTS_COLLECTION_ID || 'benchmark_reference_results';

if (!ENDPOINT || !PROJECT_ID || !DATABASE_ID || !API_KEY) {
  console.error('Missing Appwrite credentials in .env.local.');
  process.exit(1);
}

const headers = { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': API_KEY };

async function listAll(collection: string) {
  const documents: Record<string, string>[] = [];
  for (let offset = 0; ; offset += 100) {
    const queries = [{ method: 'limit', values: [100] }, { method: 'offset', values: [offset] }]
      .map(query => `queries[]=${encodeURIComponent(JSON.stringify(query))}`)
      .join('&');
    const response = await fetch(
      `${ENDPOINT}/databases/${DATABASE_ID}/collections/${collection}/documents?${queries}`,
      { headers },
    );
    if (!response.ok) throw new Error(`${response.status} listing ${collection}: ${(await response.text()).slice(0, 200)}`);
    const page = await response.json() as { total: number; documents: Record<string, string>[] };
    documents.push(...page.documents);
    if (documents.length >= page.total || !page.documents.length) return documents;
  }
}

function band(value: unknown) {
  const parsed = parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** The reference template writes bands as "Overall: 7.0" / "Task Response: 7". */
function parseAssessment(markdown: string) {
  const read = (label: string) => band(markdown.match(new RegExp(`^${label}:\\s*([\\d.]+)`, 'm'))?.[1]);
  const coherence = read('Coherence');
  const cohesion = read('Cohesion');
  return {
    overall: read('Overall'),
    taskResponse: read('Task Response'),
    // The external source reports one combined CC band, so average the split pair.
    coherenceCohesion: coherence == null ? null : (cohesion == null ? coherence : (coherence + cohesion) / 2),
    lexicalResource: read('Lexical Resource'),
    gra: read('Grammar'),
    errorCount: (markdown.match(/^### Error \d+:/gm) || []).length,
  };
}

function agreement(pairs: Array<{ human: number; model: number }>) {
  if (!pairs.length) return { n: 0, bias: 0, sd: 0, within05: 0, within10: 0 };
  const deltas = pairs.map(pair => pair.model - pair.human);
  const bias = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((sum, value) => sum + (value - bias) ** 2, 0) / deltas.length);
  const within = (tolerance: number) => deltas.filter(value => Math.abs(value) <= tolerance).length / deltas.length;
  return { n: pairs.length, bias, sd, within05: within(0.5), within10: within(1) };
}

async function main() {
  const [jobs, results] = await Promise.all([listAll(JOBS), listAll(RESULTS)]);
  const jobByBenchmark = new Map(jobs.map(job => [job.benchmark_id, job]));

  const rows: Array<{ human: Record<string, number | null>; model: ReturnType<typeof parseAssessment> }> = [];
  for (const result of results) {
    const job = jobByBenchmark.get(result.benchmark_id);
    if (!job) continue;
    let external: Record<string, unknown> = {};
    try { external = JSON.parse(job.external_scores_json || '{}'); } catch { continue; }
    const model = parseAssessment(result.assessment_markdown || '');
    if (model.overall == null || band(external.overall) == null) continue;
    rows.push({
      human: {
        overall: band(external.overall),
        taskResponse: band(external.taskResponse),
        coherenceCohesion: band(external.coherenceCohesion),
        lexicalResource: band(external.lexicalResource),
        gra: band(external.gra),
      },
      model,
    });
  }

  const criteria = ['overall', 'taskResponse', 'coherenceCohesion', 'lexicalResource', 'gra'] as const;
  const perCriterion: Record<string, ReturnType<typeof agreement>> = {};
  for (const criterion of criteria) {
    perCriterion[criterion] = agreement(
      rows
        .filter(row => row.human[criterion] != null && row.model[criterion] != null)
        .map(row => ({ human: row.human[criterion] as number, model: row.model[criterion] as number })),
    );
  }

  // Bias per human band. A healthy prompt is flat here; a sloped line means the
  // model is pulling every essay toward the middle of the scale.
  const byBand = new Map<number, number[]>();
  const errorsByBand = new Map<number, number[]>();
  for (const row of rows) {
    const human = row.human.overall as number;
    if (!byBand.has(human)) { byBand.set(human, []); errorsByBand.set(human, []); }
    byBand.get(human)!.push((row.model.overall as number) - human);
    errorsByBand.get(human)!.push(row.model.errorCount);
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const biasCurve = [...byBand.entries()].sort((a, b) => a[0] - b[0]).map(([humanBand, deltas]) => ({
    humanBand,
    n: deltas.length,
    bias: mean(deltas),
    meanErrors: mean(errorsByBand.get(humanBand)!),
    zeroErrorRate: errorsByBand.get(humanBand)!.filter(count => count === 0).length / deltas.length,
  }));

  // Slope of bias against band: 0 is calibrated, negative means regression to the mean.
  const xs = biasCurve.map(point => point.humanBand);
  const ys = biasCurve.map(point => point.bias);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const slope = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0)
    / xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

  console.log(`paired assessments: ${rows.length}\n`);
  for (const criterion of criteria) {
    const stats = perCriterion[criterion];
    console.log(
      `${criterion.padEnd(20)} n=${String(stats.n).padEnd(4)} bias=${stats.bias >= 0 ? '+' : ''}${stats.bias.toFixed(2)} `
      + `sd=${stats.sd.toFixed(2)}  |Δ|<=0.5: ${(stats.within05 * 100).toFixed(1)}%  |Δ|<=1.0: ${(stats.within10 * 100).toFixed(1)}%`,
    );
  }
  console.log(`\nbias by human band (model minus human)   slope ${slope.toFixed(3)} band/band`);
  for (const point of biasCurve) {
    console.log(
      `  ${String(point.humanBand).padEnd(5)} n=${String(point.n).padEnd(4)} `
      + `bias ${point.bias >= 0 ? '+' : ''}${point.bias.toFixed(2)}  `
      + `mean errors ${point.meanErrors.toFixed(1)}  zero-error ${(point.zeroErrorRate * 100).toFixed(0)}%`,
    );
  }

  const report = { pairedAssessments: rows.length, perCriterion, biasCurve, biasSlope: slope };

  if (BASELINE_PATH) {
    const baseline = JSON.parse(await readFile(path.resolve(BASELINE_PATH), 'utf8'));
    console.log(
      `\nvs baseline: overall |Δ|<=0.5 ${((perCriterion.overall.within05 - baseline.perCriterion.overall.within05) * 100).toFixed(1)} points, `
      + `bias slope ${(slope - baseline.biasSlope >= 0 ? '+' : '')}${(slope - baseline.biasSlope).toFixed(3)} `
      + `(toward 0 is better)`,
    );
  }

  if (OUT_PATH) {
    const resolved = path.resolve(OUT_PATH);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote ${resolved}`);
  }
}

main().catch(error => {
  console.error('Calibration analysis failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
