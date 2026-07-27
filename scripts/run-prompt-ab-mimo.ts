/**
 * Run a criterion specialist prompt against the real provider, for A/B scoring.
 *
 * Emits the same JSON shape scripts/score-prompt-ab.py reads, so a prompt
 * variant driven through MiMo (or Grok, or DeepSeek) is directly comparable to
 * the same variant driven through any other model.
 *
 *   npx tsx scripts/run-prompt-ab-mimo.ts --prompt tmp/ab/lexical-new.txt --out tmp/ab/result-new-mimo.json
 *   npx tsx scripts/run-prompt-ab-mimo.ts --prompt tmp/ab/lexical-old.txt --out tmp/ab/result-old-mimo.json --provider grok
 *
 * Needs MIMO_API_KEY (or GROK_API_KEY / DEEPSEEK_API_KEY) in .env.local.
 * Behind an egress proxy, run with NODE_USE_ENV_PROXY=1.
 */
import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assessmentPipelineV8Prompts, compactPromptProfile } from '../src/lib/writing-assessment-pipeline-v2';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const PROMPT_PATH = argValue('--prompt');
const OUT_PATH = argValue('--out');
const FIXTURES = argValue('--fixtures') || 'tmp/ab/fixtures.json';
const PROVIDER = (argValue('--provider') || 'mimo').toLowerCase();
const RUNS = Number(argValue('--runs') || 1);
const MODEL = argValue('--model');
// Production sends every specialist a promptProfile and the current prompts
// open with instructions for reading one. Without it those arms are scored
// while following instructions about data that is not there, which is a
// property of this harness rather than of the prompt.
const WITH_PROFILE = process.argv.includes('--profile');
// A specialist that consumes an earlier pass's output (coherence reading the
// cohesion thematic map) needs that output in its payload, keyed by essay.
const CONTEXT_PATH = argValue('--context');
const CONTEXT_KEY = argValue('--context-key') || 'priorAnalysis';

if (!PROMPT_PATH || !OUT_PATH) {
  console.error('Usage: --prompt <system prompt file> --out <result json> [--provider mimo|grok|deepseek] [--model id] [--runs N] [--profile]');
  process.exit(1);
}

interface ProviderConfig { endpoint: string; apiKey: string; model: string }

function providerConfig(): ProviderConfig {
  const cfg = baseProviderConfig();
  // --model used to be accepted and ignored, so a run could silently land on
  // the provider default while its log claimed otherwise.
  return MODEL ? { ...cfg, model: MODEL } : cfg;
}

function baseProviderConfig(): ProviderConfig {
  if (PROVIDER === 'grok') {
    if (!process.env.GROK_API_KEY) throw new Error('Missing GROK_API_KEY.');
    return {
      endpoint: 'https://api.x.ai/v1/chat/completions',
      apiKey: process.env.GROK_API_KEY,
      model: process.env.GROK_MODEL || 'grok-4.3',
    };
  }
  if (PROVIDER === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('Missing DEEPSEEK_API_KEY.');
    return {
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }
  if (!process.env.MIMO_API_KEY) throw new Error('Missing MIMO_API_KEY.');
  return {
    endpoint: `${(process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '')}/chat/completions`,
    apiKey: process.env.MIMO_API_KEY,
    model: process.env.MIMO_MODEL || 'mimo-v2.5',
  };
}

/** Models wrap JSON in prose or fences often enough to be worth handling. */
function parseJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : content).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('Response did not contain a JSON object.');
  }
}

async function callProvider(cfg: ProviderConfig, systemPrompt: string, userPrompt: string) {
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(Number(process.env.ASSESSMENT_LLM_TIMEOUT_MS || 240000)),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: Number(process.env.ASSESSMENT_LLM_TEMPERATURE || 0),
      max_tokens: Number(process.env.ASSESSMENT_LLM_MAX_TOKENS || 8000),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Provider returned no message content.');
  return parseJsonObject(content);
}

/**
 * Build the profile the same way v8 does, through the same provider, so an arm
 * that reads a profile is scored with one in front of it.
 */
const profileCache = new Map<string, unknown>();

async function profileFor(cfg: ProviderConfig, question: string) {
  const cached = profileCache.get(question);
  if (cached) return cached;
  const raw = await callProvider(
    cfg,
    assessmentPipelineV8Prompts.promptProfile,
    JSON.stringify({ taskPrompt: question }, null, 2),
  );
  const profile = compactPromptProfile(raw as Parameters<typeof compactPromptProfile>[0]);
  profileCache.set(question, profile);
  return profile;
}

/** The exact user payload shape runPass sends in production. */
function userPayload(question: string, essay: string, promptProfile: unknown, prior?: unknown) {
  if (!WITH_PROFILE && prior === undefined) return `Task prompt:\n${question}\n\nEssay:\n${essay}`;
  const payload: Record<string, unknown> = { taskPrompt: question, essay };
  if (WITH_PROFILE) payload.promptProfile = promptProfile;
  if (prior !== undefined) payload[CONTEXT_KEY] = prior;
  return JSON.stringify(payload, null, 2);
}

/** Drop findings whose quote is not literally in the essay, and count them. */
function pruneUnverifiedEvidence(entry: { findings?: Array<Record<string, unknown>> }, essay: string) {
  const normalized = essay.replace(/\s+/g, ' ');
  let dropped = 0;
  entry.findings = (entry.findings || []).filter(finding => {
    const evidence = (finding.evidence as Array<{ sourceText?: string }>) || [];
    const ok = evidence.length > 0 && evidence.every(item => {
      const quote = (item.sourceText || '').replace(/\s+/g, ' ').trim();
      return quote.length > 0 && normalized.includes(quote);
    });
    if (!ok) dropped += 1;
    return ok;
  });
  return dropped;
}

async function main() {
  const cfg = providerConfig();
  const systemPrompt = await readFile(path.resolve(PROMPT_PATH!), 'utf8');
  const fixtures = JSON.parse(await readFile(path.resolve(FIXTURES), 'utf8')) as Array<{
    fileId: string; docTitle: string; question: string; essay: string;
  }>;

  const contextByFile = new Map<string, unknown>();
  if (CONTEXT_PATH) {
    for (const entry of JSON.parse(await readFile(path.resolve(CONTEXT_PATH), 'utf8')) as Array<Record<string, unknown>>) {
      const { fileId, runs: _runs, ...rest } = entry;
      contextByFile.set(String(fileId), rest);
    }
  }

  console.log(`${PROVIDER} / ${cfg.model} — ${fixtures.length} essays x ${RUNS} run(s)`);
  console.log(`prompt: ${PROMPT_PATH} (${systemPrompt.length} chars)`);
  console.log(`payload: ${WITH_PROFILE ? 'production JSON, with promptProfile' : 'plain text, no promptProfile'}\n`);

  // Essays and runs are independent, so fan out. MiMo averages ~62s per call
  // (p90 178s), which made the original sequential loop cost ~18 minutes per
  // A/B pair for work that has no ordering constraint.
  let totalDropped = 0;
  const settled = await Promise.all(fixtures.flatMap(fixture =>
    Array.from({ length: RUNS }, async (_, run) => {
      try {
        const entry = await callProvider(
          cfg,
          systemPrompt,
          userPayload(
            fixture.question,
            fixture.essay,
            WITH_PROFILE ? await profileFor(cfg, fixture.question) : undefined,
            contextByFile.get(fixture.fileId),
          ),
        );
        totalDropped += pruneUnverifiedEvidence(entry, fixture.essay);
        return { fileId: fixture.fileId, entry };
      } catch (error) {
        console.error(`  ${fixture.docTitle.slice(0, 40)} run ${run + 1} failed: ${error instanceof Error ? error.message : error}`);
        return { fileId: fixture.fileId, entry: null };
      }
    }),
  ));
  const runsByFixture = new Map<string, Array<Record<string, unknown>>>();
  for (const { fileId, entry } of settled) {
    if (!entry) continue;
    if (!runsByFixture.has(fileId)) runsByFixture.set(fileId, []);
    runsByFixture.get(fileId)!.push(entry);
  }

  const results = [];
  for (const fixture of fixtures) {
    const runs = runsByFixture.get(fixture.fileId) || [];
    if (!runs.length) continue;
    // Keep every run. Picking one is unsafe on an unstable provider: MiMo
    // returned 0, 0 and 12 findings on the same essay, so the median is the
    // degenerate run rather than a defence against it. Scoring reads `runs`
    // and averages; `findings` carries the union so single-run consumers see
    // everything the provider found across attempts.
    const seen = new Set<string>();
    const union = runs.flatMap(run => (run.findings || []) as Array<Record<string, unknown>>)
      .filter(finding => {
        const key = JSON.stringify((finding.evidence as Array<{ sourceText?: string }>)?.map(e => e.sourceText) || []);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    // Keep whatever else the prompt asked for. A variant that returns a
    // summary block or a thematic map had it silently discarded here, which
    // reads as the model ignoring the instruction.
    const { band: _b, rationaleVi: _r, findings: _f, ...extras } = runs[0];
    results.push({
      fileId: fixture.fileId,
      band: runs[0].band,
      rationaleVi: runs[0].rationaleVi,
      ...extras,
      findings: union,
      runs: runs.map(run => {
        const { findings, ...rest } = run;
        return { ...rest, findings: findings || [] };
      }),
    });
    console.log(
      `  ${fixture.docTitle.slice(0, 44).padEnd(46)} bands ${runs.map(r => r.band).join('/')}  `
      + `findings ${runs.map(r => (r.findings as unknown[] | undefined)?.length || 0).join('/')}`,
    );
  }

  const resolved = path.resolve(OUT_PATH!);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(results, null, 1), 'utf8');
  console.log(`\ndropped for unverifiable evidence: ${totalDropped}`);
  console.log(`wrote ${resolved}`);
}

main().catch(error => {
  console.error('Run failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
