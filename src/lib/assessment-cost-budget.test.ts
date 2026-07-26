import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssessmentCostBudget,
  AssessmentCostBudgetExceededError,
  calculateTokenCostUsd,
} from './assessment-cost-budget';

const prices = {
  inputCacheHitUsdPerMillion: 0.03,
  inputCacheMissUsdPerMillion: 0.3,
  outputUsdPerMillion: 0.5,
};

test('calculates cache-aware token cost and treats unclassified input as cache misses', () => {
  const cost = calculateTokenCostUsd({
    promptTokens: 1_000_000,
    completionTokens: 100_000,
    cacheHitTokens: 200_000,
    cacheMissTokens: 700_000,
  }, prices);

  assert.equal(cost, 0.296);
});

test('counts concurrent reservations against the cap', () => {
  const budget = new AssessmentCostBudget(0.001, prices);
  const usage = {
    promptTokens: 1_000,
    completionTokens: 1_000,
    cacheHitTokens: 0,
    cacheMissTokens: 1_000,
  };

  budget.reserve('first', usage);
  assert.throws(() => budget.reserve('second', usage), AssessmentCostBudgetExceededError);
});

test('reconciles actual usage and makes the unused reservation available', () => {
  const budget = new AssessmentCostBudget(0.001, prices);
  const maximumUsage = {
    promptTokens: 1_000,
    completionTokens: 1_000,
    cacheHitTokens: 0,
    cacheMissTokens: 1_000,
  };
  const reservation = budget.reserve('first', maximumUsage);

  budget.reconcile(reservation, {
    promptTokens: 100,
    completionTokens: 100,
    cacheHitTokens: 0,
    cacheMissTokens: 100,
  });
  budget.reserve('second', maximumUsage);

  assert.equal(budget.snapshot().requestCount, 1);
  assert.ok(budget.snapshot().remainingCostUsd > 0);
});

test('charges the full reservation when provider usage is unavailable', () => {
  const budget = new AssessmentCostBudget(0.001, prices);
  const reservation = budget.reserve('failed-request', {
    promptTokens: 1_000,
    completionTokens: 1_000,
    cacheHitTokens: 0,
    cacheMissTokens: 1_000,
  });

  budget.reconcile(reservation);
  assert.equal(budget.snapshot().spentCostUsd, reservation.estimatedCostUsd);
});

test('fails closed when reported provider usage exceeds the reservation', () => {
  const budget = new AssessmentCostBudget(0.001, prices);
  const reservation = budget.reserve('under-reserved', {
    promptTokens: 100,
    completionTokens: 100,
    cacheHitTokens: 0,
    cacheMissTokens: 100,
  });

  assert.throws(() => budget.reconcile(reservation, {
    promptTokens: 2_000,
    completionTokens: 2_000,
    cacheHitTokens: 0,
    cacheMissTokens: 2_000,
  }), AssessmentCostBudgetExceededError);
});
