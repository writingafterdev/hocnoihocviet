export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface TokenPrices {
  inputCacheHitUsdPerMillion: number;
  inputCacheMissUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface CostReservation {
  id: number;
  label: string;
  estimatedCostUsd: number;
}

export interface CostBudgetSnapshot {
  maxCostUsd: number;
  spentCostUsd: number;
  reservedCostUsd: number;
  remainingCostUsd: number;
  requestCount: number;
}

export class AssessmentCostBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessmentCostBudgetExceededError';
  }
}

function assertNonNegativeFinite(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number.`);
  }
}

export function calculateTokenCostUsd(usage: TokenUsage, prices: TokenPrices) {
  const knownPromptTokens = usage.cacheHitTokens + usage.cacheMissTokens;
  const unclassifiedPromptTokens = Math.max(0, usage.promptTokens - knownPromptTokens);
  const cacheMissTokens = usage.cacheMissTokens + unclassifiedPromptTokens;

  return (
    usage.cacheHitTokens * prices.inputCacheHitUsdPerMillion
    + cacheMissTokens * prices.inputCacheMissUsdPerMillion
    + usage.completionTokens * prices.outputUsdPerMillion
  ) / 1_000_000;
}

export class AssessmentCostBudget {
  readonly maxCostUsd: number;
  readonly prices: TokenPrices;
  private spentCostUsd = 0;
  private reservedCostUsd = 0;
  private nextReservationId = 1;
  private requestCount = 0;
  private readonly openReservations = new Map<number, CostReservation>();

  constructor(maxCostUsd: number, prices: TokenPrices) {
    if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
      throw new Error('Assessment benchmark maximum cost must be a positive finite number.');
    }
    Object.entries(prices).forEach(([name, value]) => assertNonNegativeFinite(name, value));
    this.maxCostUsd = maxCostUsd;
    this.prices = prices;
  }

  reserve(label: string, maximumUsage: TokenUsage): CostReservation {
    const estimatedCostUsd = calculateTokenCostUsd(maximumUsage, this.prices);
    const projectedCostUsd = this.spentCostUsd + this.reservedCostUsd + estimatedCostUsd;
    if (projectedCostUsd > this.maxCostUsd + Number.EPSILON) {
      throw new AssessmentCostBudgetExceededError(
        `Assessment benchmark cost cap would be exceeded before ${label}: `
        + `$${projectedCostUsd.toFixed(6)} projected > $${this.maxCostUsd.toFixed(6)} cap.`,
      );
    }

    const reservation = { id: this.nextReservationId, label, estimatedCostUsd };
    this.nextReservationId += 1;
    this.reservedCostUsd += estimatedCostUsd;
    this.openReservations.set(reservation.id, reservation);
    return reservation;
  }

  reconcile(reservation: CostReservation, actualUsage?: TokenUsage) {
    const openReservation = this.openReservations.get(reservation.id);
    if (!openReservation) throw new Error(`Unknown or closed cost reservation: ${reservation.id}.`);

    this.openReservations.delete(reservation.id);
    this.reservedCostUsd -= openReservation.estimatedCostUsd;
    const actualCostUsd = actualUsage
      ? calculateTokenCostUsd(actualUsage, this.prices)
      : openReservation.estimatedCostUsd;
    this.spentCostUsd += actualCostUsd;
    this.requestCount += 1;

    if (this.spentCostUsd + this.reservedCostUsd > this.maxCostUsd + Number.EPSILON) {
      throw new AssessmentCostBudgetExceededError(
        `Assessment benchmark provider usage exceeded its reserved cost for ${reservation.label}.`,
      );
    }
    return actualCostUsd;
  }

  snapshot(): CostBudgetSnapshot {
    return {
      maxCostUsd: this.maxCostUsd,
      spentCostUsd: this.spentCostUsd,
      reservedCostUsd: this.reservedCostUsd,
      remainingCostUsd: Math.max(0, this.maxCostUsd - this.spentCostUsd - this.reservedCostUsd),
      requestCount: this.requestCount,
    };
  }
}
