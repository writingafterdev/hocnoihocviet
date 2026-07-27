import { AsyncLocalStorage } from 'node:async_hooks';
import type { AssessmentModelCall, AssessmentRun } from '@/types/writing';

interface MutableAssessmentRun {
  run: AssessmentRun;
  calls: AssessmentModelCall[];
}

const storage = new AsyncLocalStorage<MutableAssessmentRun>();

export async function withAssessmentRun<T>(
  run: AssessmentRun,
  operation: () => Promise<T>,
): Promise<{ value: T; run: AssessmentRun }> {
  const context: MutableAssessmentRun = { run, calls: [] };
  const value = await storage.run(context, operation);
  const completedAt = new Date().toISOString();
  const calls = [...context.calls];
  const promptTokens = calls.reduce((sum, call) => sum + call.promptTokens, 0);
  const completionTokens = calls.reduce((sum, call) => sum + call.completionTokens, 0);
  const totalTokens = calls.reduce((sum, call) => sum + call.totalTokens, 0);
  return {
    value,
    run: {
      ...context.run,
      completedAt,
      durationMs: Date.parse(completedAt) - Date.parse(context.run.startedAt),
      calls,
      usage: { promptTokens, completionTokens, totalTokens },
    },
  };
}

export function recordAssessmentModelCall(call: AssessmentModelCall) {
  storage.getStore()?.calls.push(call);
}
