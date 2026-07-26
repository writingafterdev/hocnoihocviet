import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';

let errorOutputPath: string | undefined;

function positiveNumber(name: string, rawValue: string | undefined, fallback: number) {
  const value = rawValue === undefined ? fallback : Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
  return value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      'max-usd': { type: 'string', default: '0.10' },
      'env-file': { type: 'string', default: '.env.local' },
      pipeline: { type: 'string', default: 'v8' },
      provider: { type: 'string' },
      'core-only': { type: 'boolean', default: false },
      'max-tokens': { type: 'string' },
      'timeout-ms': { type: 'string' },
      reasoning: { type: 'boolean', default: false },
      'error-output': { type: 'string' },
    },
  });
  if (!values.input) throw new Error('Usage: npm run benchmark:assessment -- --provider deepseek|mimo --input request.json [--output result.json] [--max-usd 0.10]');
  errorOutputPath = values['error-output'];
  if (errorOutputPath) await writeFile(resolve(errorOutputPath), '', { mode: 0o600 });

  config({ path: resolve(values['env-file']), quiet: true });
  const provider = (values.provider || process.env.ASSESSMENT_LLM_PROVIDER || 'deepseek').toLowerCase();
  if (provider !== 'deepseek' && provider !== 'mimo') {
    throw new Error('--provider must be deepseek or mimo.');
  }
  const apiKeyName = provider === 'mimo' ? 'MIMO_API_KEY' : 'DEEPSEEK_API_KEY';
  if (!process.env[apiKeyName]) throw new Error(`${apiKeyName} is not configured.`);

  process.env.ASSESSMENT_LLM_PROVIDER = provider;
  if (values['core-only']) process.env.ASSESSMENT_BENCHMARK_CORE_ONLY = 'true';
  process.env.ASSESSMENT_BENCHMARK_MODE = 'true';
  process.env.ASSESSMENT_BENCHMARK_MAX_USD = String(
    positiveNumber('--max-usd', values['max-usd'], 0.10),
  );
  if (values['max-tokens']) {
    process.env.ASSESSMENT_LLM_MAX_TOKENS = String(
      positiveNumber('--max-tokens', values['max-tokens'], 12000),
    );
  }
  if (values['timeout-ms']) {
    process.env.ASSESSMENT_LLM_TIMEOUT_MS = String(
      positiveNumber('--timeout-ms', values['timeout-ms'], 180000),
    );
  }
  if (provider === 'mimo') process.env.MIMO_REASONING_ENABLED = values.reasoning ? 'true' : 'false';

  const request = JSON.parse(await readFile(resolve(values.input), 'utf8')) as {
    prompt?: unknown;
    essay?: unknown;
  };
  if (typeof request.prompt !== 'string' || typeof request.essay !== 'string') {
    throw new Error('Benchmark input must be JSON with string prompt and essay fields.');
  }

  // Import after benchmark environment is locked so no paid call can bypass the ledger.
  const [{ buildEssayManifest }, { runWritingAssessmentPipelineV2, runWritingAssessmentPipelineV3, runWritingAssessmentPipelineV4, runWritingAssessmentPipelineV5, runWritingAssessmentPipelineV6, runWritingAssessmentPipelineV7, runWritingAssessmentPipelineV8 }, { getAssessmentBenchmarkCostSnapshot }] = await Promise.all([
    import('../src/lib/writing-analysis-contract'),
    import('../src/lib/writing-assessment-pipeline-v2'),
    import('../src/lib/assessment-llm'),
  ]);
  const pipeline = values.pipeline?.toLowerCase();
  if (pipeline !== 'v2' && pipeline !== 'v3' && pipeline !== 'v4' && pipeline !== 'v5' && pipeline !== 'v6' && pipeline !== 'v7' && pipeline !== 'v8') {
    throw new Error('--pipeline must be v2, v3, v4, v5, v6, v7, or v8.');
  }
  const runPipeline = pipeline === 'v2'
    ? runWritingAssessmentPipelineV2
    : pipeline === 'v7'
      ? runWritingAssessmentPipelineV7
    : pipeline === 'v8'
      ? runWritingAssessmentPipelineV8
    : pipeline === 'v6'
      ? runWritingAssessmentPipelineV6
      : pipeline === 'v5'
      ? runWritingAssessmentPipelineV5
      : pipeline === 'v4'
        ? runWritingAssessmentPipelineV4
        : runWritingAssessmentPipelineV3;
  const startedAt = Date.now();
  const analysis = await runPipeline({
    prompt: request.prompt,
    essay: request.essay,
    manifest: buildEssayManifest(request.essay),
  });

  if (values.output) {
    await writeFile(resolve(values.output), JSON.stringify({ analysis }, null, 2), { mode: 0o600 });
  }
  console.info('[assessment-benchmark-total]', JSON.stringify({
    pipeline,
    provider,
    durationMs: Date.now() - startedAt,
    outputBytes: Buffer.byteLength(JSON.stringify(analysis)),
    cost: getAssessmentBenchmarkCostSnapshot(),
  }));
}

main().catch(error => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('[assessment-benchmark-failed]', message);
  if (errorOutputPath) {
    writeFile(resolve(errorOutputPath), message, { mode: 0o600 }).catch(() => undefined);
  }
  process.exitCode = 1;
});
