/**
 * Stage-2 selection experiment: given a candidate pool produced by a
 * high-volume generation pass, can a judge pass pick the few findings a real
 * examiner would consider band-critical?
 *
 * Oracle selection on the same pools scores ~24.5% precision@3 against
 * examiner anchors while the model's own severity labels score 9.4%, so the
 * headroom lives in selection, not generation.
 *
 *   npx tsx scripts/run-critical-judge.ts --fixtures tmp/ab/coh-recovered-fixtures.json \
 *     --pool tmp/ab/proc-coh-substitution.json --out tmp/ab/judge-coh.json --criterion cohesion
 */
import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const FIXTURES = argValue('--fixtures')!;
const POOL = argValue('--pool')!;
const OUT = argValue('--out')!;
const CRITERION = argValue('--criterion') || 'cohesion';
const K = Number(argValue('--k') || 3);

const JUDGE_SYSTEM = `You are a senior IELTS examiner reviewing another marker's draft annotations before they go to the student. Return JSON only.

You receive an essay and a numbered list of candidate findings for one criterion. Most candidates are technically defensible but trivial; a real examiner would mention only a few. Your job is to choose the at most ${K} candidates that most affect the band for this criterion — the ones an examiner would actually write in the margin.

Prefer a candidate that names a problem the writer repeats over one that names a one-off. Prefer a problem that makes the reader's job harder over a stylistic preference. Prefer the sentence a busy examiner would underline first.

Do not rewrite the findings. Do not add new ones. Choose only from the list.

Return JSON only:
{ "selected": [0], "reasonVi": "one short Vietnamese sentence per chosen index, joined with ;" }`;

async function callMimo(system: string, user: string) {
  const response = await fetch(`${(process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(Number(process.env.ASSESSMENT_LLM_TIMEOUT_MS || 420000)),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MIMO_API_KEY}` },
    body: JSON.stringify({
      model: process.env.MIMO_MODEL || 'mimo-v2.5',
      temperature: 0,
      max_tokens: Number(process.env.ASSESSMENT_LLM_MAX_TOKENS || 32000),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('no message content');
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : content).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function main() {
  const fixtures = JSON.parse(await readFile(FIXTURES, 'utf8')) as Array<{ fileId: string; question: string; essay: string }>;
  const pool = new Map(
    (JSON.parse(await readFile(POOL, 'utf8')) as Array<{ fileId: string; runs?: Array<{ findings: unknown[] }> }>)
      .map(e => [e.fileId, e]),
  );
  const results = [];
  for (const fixture of fixtures) {
    const entry = pool.get(fixture.fileId);
    // Judge the union pool across runs so selection sees every candidate once.
    const seen = new Set<string>();
    const candidates = (entry?.runs || []).flatMap(r => r.findings as Array<Record<string, unknown>>)
      .filter(f => {
        const key = JSON.stringify((f.evidence as Array<{ sourceText?: string }>)?.map(e => e.sourceText) || []);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!candidates.length) continue;
    const listing = candidates.map((f, i) =>
      `${i}. [${f.severity}] ${f.errorLabelVi} — "${((f.evidence as Array<{ sourceText?: string }>) || []).map(e => e.sourceText).join(' … ')}" — ${f.explanationVi}`,
    ).join('\n');
    try {
      const verdict = await callMimo(
        JUDGE_SYSTEM,
        `Criterion: ${CRITERION}\n\nTask prompt:\n${fixture.question}\n\nEssay:\n${fixture.essay}\n\nCandidates:\n${listing}`,
      );
      const chosen = (verdict.selected as number[]).filter(i => i >= 0 && i < candidates.length).slice(0, K);
      results.push({
        fileId: fixture.fileId,
        findings: chosen.map(i => candidates[i]),
        runs: [{ findings: chosen.map(i => candidates[i]) }],
        candidateCount: candidates.length,
      });
      console.log(`  ${fixture.fileId.slice(0, 44).padEnd(44)} ${candidates.length} candidates -> ${chosen.length} chosen`);
    } catch (error) {
      console.error(`  ${fixture.fileId.slice(0, 44)} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  await writeFile(OUT, JSON.stringify(results, null, 1));
  console.log(`wrote ${OUT} (${results.length} essays)`);
}

main();
