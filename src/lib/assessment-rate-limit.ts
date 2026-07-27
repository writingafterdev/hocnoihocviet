interface RateState {
  attempts: number[];
  active: number;
}

export class AssessmentRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'AssessmentRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const states = new Map<string, RateState>();

function positiveIntegerEnvironment(name: string, fallback: number) {
  const parsed = Number(process.env[name] || fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function acquireAssessmentSlot(userId: string) {
  const now = Date.now();
  const windowMs = positiveIntegerEnvironment('ASSESSMENT_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000);
  const maxAttempts = positiveIntegerEnvironment('ASSESSMENT_RATE_LIMIT_MAX_REQUESTS', 6);
  const maxConcurrent = positiveIntegerEnvironment('ASSESSMENT_RATE_LIMIT_MAX_CONCURRENT', 1);
  const state = states.get(userId) || { attempts: [], active: 0 };
  state.attempts = state.attempts.filter(timestamp => now - timestamp < windowMs);

  if (state.active >= maxConcurrent) {
    throw new AssessmentRateLimitError(
      'An assessment is already running for this account.',
      30,
    );
  }
  if (state.attempts.length >= maxAttempts) {
    const retryAt = state.attempts[0] + windowMs;
    throw new AssessmentRateLimitError(
      'Assessment limit reached. Please try again later.',
      Math.max(1, Math.ceil((retryAt - now) / 1000)),
    );
  }

  state.attempts.push(now);
  state.active += 1;
  states.set(userId, state);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    const current = states.get(userId);
    if (!current) return;
    current.active = Math.max(0, current.active - 1);
    if (!current.active && !current.attempts.length) states.delete(userId);
  };
}
