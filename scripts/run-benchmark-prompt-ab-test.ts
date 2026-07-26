import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type ImportedJob = {
  id: string;
  benchmarkId: string;
  status: string;
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
};

type Variant = {
  label: string;
  systemPrompt: string;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function wholeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bucket(overall: unknown) {
  const score = wholeNumber(overall);
  if (score === null) return 'unknown';
  if (score < 6.25) return 'low';
  if (score < 7.25) return 'mid';
  return 'high';
}

function essayWordCount(value: string) {
  return (value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/g) || []).length;
}

function buildV225LikePrompt(systemPrompt: string) {
  return systemPrompt
    .replace(
      /\n- Do not mention “repeated grammar errors”, “recurring vocabulary issues”, or similar broad language weakness in First Impression unless Section 5 contains a representative Grammar or Lexical Resource finding that proves the pattern with exact evidence\. If you are not going to report the pattern as a material error, do not preview it as a limitation\./,
      '',
    )
    .replace(
      /\n- Word count: if the essay is below 250 words, include one Must-Catch Task Response error named around “Bài dưới 250 từ”\. Quote the supplied word-count line as evidence if exact essay evidence is not useful\. Explain that this is a factual risk because IELTS Task 2 requires at least 250 words, but do not treat it as automatic failure\./,
      '',
    )
    .replace(
      /\nFor each hard Lexical Resource finding, name the exact local problem and provide a direct correction or alternative\. If you cannot point to the exact word\/phrase and say what should replace it, move the point to Optional \/ Style Suggestions or omit it\.\nDo not satisfy Lexical Resource by saying only “many small vocabulary mistakes” or “word choice is not precise”\. That is a score rationale, not a benchmark finding\./,
      '',
    );
}

function buildUserPrompt(input: ImportedJob) {
  return `# Reference Scores From External Assessor

Source: YouPass page scrape
Source URL: ${input.sourceUrl || 'unknown'}

Overall: ${input.scores.overall || 'unknown'}
Task Response: ${input.scores.taskResponse || 'unknown'}
Coherence & Cohesion: ${input.scores.coherenceCohesion || 'unknown'}
Coherence: ${input.scores.coherenceCohesion || 'unknown'} (provisional copy from combined CC score)
Cohesion: ${input.scores.coherenceCohesion || 'unknown'} (provisional copy from combined CC score)
Lexical Resource: ${input.scores.lexicalResource || 'unknown'}
Grammar: ${input.scores.gra || 'unknown'}

Note: The external assessor provides one combined Coherence & Cohesion score. Coherence and Cohesion are copied provisionally only so the benchmark can be completed; keep the combined score as the source of truth.

# Input

Exam question:
${input.question}

Essay word count:
${essayWordCount(input.essay)}

Essay:
${input.essay}
`;
}

function extractScores(markdown: string) {
  const scoreBlock = markdown.match(/## 1\. Scores([\s\S]*?)(?:\n## |\n# |$)/)?.[1] || markdown.slice(0, 2500);
  const read = (label: string) => {
    const match = scoreBlock.match(new RegExp(`${label}:\\s*([0-9](?:\\.5)?)`, 'i'));
    return match ? Number(match[1]) : null;
  };
  return {
    overall: read('Overall'),
    taskResponse: read('Task Response'),
    coherence: read('Coherence'),
    cohesion: read('Cohesion'),
    lexicalResource: read('Lexical Resource'),
    grammar: read('Grammar'),
  };
}

function extractErrorTitles(markdown: string) {
  return Array.from(markdown.matchAll(/^### Error \d+:\s*(.+)$/gm)).map(match => match[1].trim());
}

function selectBalanced(jobs: ImportedJob[], perBucket: number) {
  const seen = new Set<string>();
  const unique = jobs.filter((job) => {
    const key = `${job.question.trim()}\n---\n${job.essay.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const selected: ImportedJob[] = [];
  for (const name of ['low', 'mid', 'high']) {
    selected.push(...unique.filter(job => bucket(job.scores.overall) === name).slice(0, perBucket));
  }
  return selected;
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function main() {
  const outDir = path.resolve(argValue('--out-dir') || 'tmp/benchmark-prompt-ab/latest');
  const perBucket = Number(argValue('--per-bucket') || 2);
  const concurrency = Math.max(1, Math.min(4, Number(argValue('--concurrency') || 2)));

  const { listBenchmarkReferenceJobs, callMimoMarkdown } = await import('../src/lib/benchmark-reference-jobs');
  const { buildBenchmarkSystemPrompt, BENCHMARK_REFERENCE_SYSTEM_PROMPT_VERSION } = await import('../src/lib/benchmark-reference-prompt');

  const jobs = (await listBenchmarkReferenceJobs(600))
    .filter((job) => job.sourceUrl.startsWith('https'))
    .filter((job) => job.question.trim() && job.essay.trim())
    .map(job => job as ImportedJob);
  const selected = selectBalanced(jobs, perBucket);
  const currentSystemPrompt = buildBenchmarkSystemPrompt();
  const variants: Variant[] = [
    {
      label: 'benchmark-reference-v2.2.5-like',
      systemPrompt: buildV225LikePrompt(currentSystemPrompt),
    },
    {
      label: BENCHMARK_REFERENCE_SYSTEM_PROMPT_VERSION,
      systemPrompt: currentSystemPrompt,
    },
  ];

  await mkdir(outDir, { recursive: true });
  const tasks = selected.flatMap(job => variants.map(variant => ({ job, variant })));
  const startedAt = Date.now();

  const results = await runPool(tasks, concurrency, async ({ job, variant }) => {
    const prompt = `${variant.systemPrompt}\n\n---\n\n${buildUserPrompt(job)}`;
    const started = Date.now();
    console.info('[benchmark-ab] start', variant.label, job.id, job.scores.overall, job.question.slice(0, 70));
    try {
      const response = await callMimoMarkdown(prompt);
      const assessmentMarkdown = response.content;
      const item = {
        status: 'complete',
        variant: variant.label,
        jobId: job.id,
        benchmarkId: job.benchmarkId,
        sourceUrl: job.sourceUrl,
        externalOverall: job.scores.overall || '',
        bucket: bucket(job.scores.overall),
        question: job.question,
        essay: job.essay,
        assessmentMarkdown,
        extracted: {
          scores: extractScores(assessmentMarkdown),
          errorTitles: extractErrorTitles(assessmentMarkdown),
        },
        usage: response.usage,
        durationMs: response.durationMs || Date.now() - started,
      };
      console.info('[benchmark-ab] complete', variant.label, job.id, `${item.durationMs}ms`);
      return item;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[benchmark-ab] failed', variant.label, job.id, message);
      return {
        status: 'failed',
        variant: variant.label,
        jobId: job.id,
        benchmarkId: job.benchmarkId,
        sourceUrl: job.sourceUrl,
        externalOverall: job.scores.overall || '',
        bucket: bucket(job.scores.overall),
        question: job.question,
        essay: job.essay,
        error: message,
        durationMs: Date.now() - started,
      };
    }
  });

  const byJob = new Map<string, typeof results>();
  for (const result of results) {
    const items = byJob.get(result.jobId) || [];
    items.push(result);
    byJob.set(result.jobId, items);
  }

  const comparisons = Array.from(byJob.entries()).map(([jobId, items]) => {
    const byVariant = Object.fromEntries(items.map(item => [item.variant, item]));
    return { jobId, variants: byVariant };
  });

  const summary = {
    selectedJobs: selected.length,
    calls: results.length,
    complete: results.filter(item => item.status === 'complete').length,
    failed: results.filter(item => item.status === 'failed').length,
    elapsedMs: Date.now() - startedAt,
    variants: variants.map(variant => variant.label),
    buckets: selected.reduce<Record<string, number>>((acc, job) => {
      const name = bucket(job.scores.overall);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {}),
  };

  const report = [
    '# Benchmark Prompt A/B Test',
    '',
    `Selected jobs: ${summary.selectedJobs}`,
    `Calls: ${summary.calls}`,
    `Complete: ${summary.complete}`,
    `Failed: ${summary.failed}`,
    `Elapsed ms: ${summary.elapsedMs}`,
    '',
    ...comparisons.flatMap((comparison) => {
      const first = Object.values(comparison.variants)[0];
      return [
        `## ${comparison.jobId}`,
        '',
        `External overall: ${first.externalOverall} | Bucket: ${first.bucket}`,
        '',
        `Question: ${first.question}`,
        '',
        ...variants.flatMap((variant) => {
          const item = comparison.variants[variant.label];
          if (!item || item.status === 'failed') {
            return [
              `### ${variant.label}`,
              '',
              `Failed: ${item && 'error' in item ? item.error : 'missing result'}`,
              '',
            ];
          }
          return [
            `### ${variant.label}`,
            '',
            `Scores: ${JSON.stringify('extracted' in item ? item.extracted.scores : {})}`,
            '',
            'Errors:',
            ...('extracted' in item ? item.extracted.errorTitles.map((title: string) => `- ${title}`) : []),
            '',
          ];
        }),
        '---',
        '',
      ];
    }),
  ].join('\n');

  await Promise.all([
    writeFile(path.join(outDir, 'results.json'), JSON.stringify({ summary, results, comparisons }, null, 2)),
    writeFile(path.join(outDir, 'report.md'), report),
  ]);

  console.info(JSON.stringify({
    ...summary,
    outputJson: path.join(outDir, 'results.json'),
    outputMarkdown: path.join(outDir, 'report.md'),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
