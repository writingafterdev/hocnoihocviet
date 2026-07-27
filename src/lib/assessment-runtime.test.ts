import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireAssessmentSlot, AssessmentRateLimitError } from './assessment-rate-limit';
import { recordAssessmentModelCall, withAssessmentRun } from './assessment-run-context';
import type { AssessmentRun } from '@/types/writing';

test('assessment rate limiter blocks a concurrent run for the same user and releases it', () => {
  const userId = `rate-test-${crypto.randomUUID()}`;
  const release = acquireAssessmentSlot(userId);
  assert.throws(
    () => acquireAssessmentSlot(userId),
    (error: unknown) => error instanceof AssessmentRateLimitError,
  );
  release();
  const releaseAgain = acquireAssessmentSlot(userId);
  releaseAgain();
});

test('assessment run telemetry aggregates provider token usage', async () => {
  const run: AssessmentRun = {
    schemaVersion: '2026-07-28',
    assessmentId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    pipelineVersion: 'v8',
    promptVersion: 'v12-free-strength',
    provider: 'test',
    model: 'test',
    startedAt: new Date().toISOString(),
    status: 'complete',
    incompletePasses: [],
  };

  const completed = await withAssessmentRun(run, async () => {
    recordAssessmentModelCall({
      label: 'test-pass',
      provider: 'test',
      model: 'test',
      status: 'success',
      durationMs: 12,
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
    });
    return 'done';
  });

  assert.equal(completed.value, 'done');
  assert.deepEqual(completed.run.usage, {
    promptTokens: 100,
    completionTokens: 25,
    totalTokens: 125,
  });
  assert.equal(completed.run.calls?.[0]?.label, 'test-pass');
});
