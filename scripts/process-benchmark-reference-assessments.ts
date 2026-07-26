import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const {
    getNextQueuedBenchmarkReferenceJob,
    processBenchmarkReferenceJob,
  } = await import('../src/lib/benchmark-reference-jobs');

  const once = process.argv.includes('--once');
  const limit = Number(argValue('--limit') || (once ? 1 : 20));
  const poll = process.argv.includes('--poll');
  const intervalMs = Number(argValue('--interval-ms') || 5000);

  let processed = 0;

  while (processed < limit) {
    const job = await getNextQueuedBenchmarkReferenceJob();
    if (!job) {
      if (!poll) {
        console.info('[benchmark-worker] no queued jobs');
        return;
      }
      await sleep(intervalMs);
      continue;
    }

    console.info('[benchmark-worker] processing', JSON.stringify({
      jobId: job.id,
      benchmarkId: job.benchmarkId,
      question: job.question.slice(0, 100),
    }));

    try {
      const result = await processBenchmarkReferenceJob(job);
      processed += 1;
      console.info('[benchmark-worker] complete', JSON.stringify(result));
    } catch (error) {
      processed += 1;
      console.error('[benchmark-worker] failed', error instanceof Error ? error.message : error);
    }

    if (once) return;
  }
}

main().catch((error) => {
  console.error('[benchmark-worker] fatal', error);
  process.exitCode = 1;
});
