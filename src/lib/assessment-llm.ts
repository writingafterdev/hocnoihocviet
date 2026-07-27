import {
  AssessmentCostBudget,
  type CostReservation,
  type TokenUsage,
} from '@/lib/assessment-cost-budget';
import { recordAssessmentModelCall } from '@/lib/assessment-run-context';

export class AssessmentProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AssessmentProviderError';
    this.status = status;
  }
}

const DEEPSEEK_DEFAULT_PRICES = {
  inputCacheHitUsdPerMillion: 0.0028,
  inputCacheMissUsdPerMillion: 0.14,
  outputUsdPerMillion: 0.28,
};

const MIMO_DEFAULT_PRICES = {
  inputCacheHitUsdPerMillion: 0.0028,
  inputCacheMissUsdPerMillion: 0.14,
  outputUsdPerMillion: 0.28,
};

let benchmarkBudget: AssessmentCostBudget | undefined;

function finiteEnvironmentNumber(name: string, fallback: number) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number.`);
  return value;
}

function deepSeekBenchmarkBudget(model: string) {
  if (process.env.ASSESSMENT_BENCHMARK_MODE !== 'true') return undefined;
  const modelsCoveredByDefaults = new Set(['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash']);
  const priceVariables = [
    'DEEPSEEK_INPUT_CACHE_HIT_USD_PER_MILLION',
    'DEEPSEEK_INPUT_CACHE_MISS_USD_PER_MILLION',
    'DEEPSEEK_OUTPUT_USD_PER_MILLION',
  ];
  if (!modelsCoveredByDefaults.has(model) && priceVariables.some(name => process.env[name] === undefined)) {
    throw new Error(
      `Custom DeepSeek model ${model} requires all benchmark pricing environment variables.`,
    );
  }
  if (!benchmarkBudget) {
    benchmarkBudget = new AssessmentCostBudget(
      finiteEnvironmentNumber('ASSESSMENT_BENCHMARK_MAX_USD', 0.10),
      {
        inputCacheHitUsdPerMillion: finiteEnvironmentNumber(
          'DEEPSEEK_INPUT_CACHE_HIT_USD_PER_MILLION',
          DEEPSEEK_DEFAULT_PRICES.inputCacheHitUsdPerMillion,
        ),
        inputCacheMissUsdPerMillion: finiteEnvironmentNumber(
          'DEEPSEEK_INPUT_CACHE_MISS_USD_PER_MILLION',
          DEEPSEEK_DEFAULT_PRICES.inputCacheMissUsdPerMillion,
        ),
        outputUsdPerMillion: finiteEnvironmentNumber(
          'DEEPSEEK_OUTPUT_USD_PER_MILLION',
          DEEPSEEK_DEFAULT_PRICES.outputUsdPerMillion,
        ),
      },
    );
  }
  return benchmarkBudget;
}

function mimoBenchmarkBudget(model: string) {
  if (process.env.ASSESSMENT_BENCHMARK_MODE !== 'true') return undefined;
  const modelsCoveredByDefaults = new Set(['mimo-v2.5']);
  const priceVariables = [
    'MIMO_INPUT_CACHE_HIT_USD_PER_MILLION',
    'MIMO_INPUT_CACHE_MISS_USD_PER_MILLION',
    'MIMO_OUTPUT_USD_PER_MILLION',
  ];
  if (!modelsCoveredByDefaults.has(model) && priceVariables.some(name => process.env[name] === undefined)) {
    throw new Error(
      `Custom MiMo model ${model} requires all benchmark pricing environment variables.`,
    );
  }
  if (!benchmarkBudget) {
    benchmarkBudget = new AssessmentCostBudget(
      finiteEnvironmentNumber('ASSESSMENT_BENCHMARK_MAX_USD', 0.10),
      {
        inputCacheHitUsdPerMillion: finiteEnvironmentNumber(
          'MIMO_INPUT_CACHE_HIT_USD_PER_MILLION',
          MIMO_DEFAULT_PRICES.inputCacheHitUsdPerMillion,
        ),
        inputCacheMissUsdPerMillion: finiteEnvironmentNumber(
          'MIMO_INPUT_CACHE_MISS_USD_PER_MILLION',
          MIMO_DEFAULT_PRICES.inputCacheMissUsdPerMillion,
        ),
        outputUsdPerMillion: finiteEnvironmentNumber(
          'MIMO_OUTPUT_USD_PER_MILLION',
          MIMO_DEFAULT_PRICES.outputUsdPerMillion,
        ),
      },
    );
  }
  return benchmarkBudget;
}

function usageFromProvider(usage: Record<string, unknown> | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  const parsed = {
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    cacheHitTokens: Number(usage.prompt_cache_hit_tokens || 0),
    cacheMissTokens: Number(usage.prompt_cache_miss_tokens || 0),
  };
  return Object.values(parsed).every(value => Number.isFinite(value) && value >= 0)
    ? parsed
    : undefined;
}

function maximumRequestUsage(messages: Array<{ role: string; content: string }>, maxTokens: number): TokenUsage {
  // A token cannot contain less than one UTF-8 byte. The fixed allowance covers chat framing.
  const promptTokens = Buffer.byteLength(JSON.stringify(messages), 'utf8') + 1_024;
  return { promptTokens, completionTokens: maxTokens, cacheHitTokens: 0, cacheMissTokens: promptTokens };
}

export function getAssessmentBenchmarkCostSnapshot() {
  return benchmarkBudget?.snapshot();
}

function extractJSON(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('The model response was not JSON.');
  }
}

async function generateJSONWithProvider<T>({
  apiKey,
  endpoint,
  model,
  systemPrompt,
  userPrompt,
  providerName,
  requestLabel,
  reasoning,
  costBudget,
  maxTokensField = 'max_tokens',
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  providerName: string;
  requestLabel?: string;
  reasoning?: { enabled: boolean; effort?: 'high' | 'max' };
  costBudget?: AssessmentCostBudget;
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}): Promise<T> {
  const startedAt = Date.now();
  let telemetryRecorded = false;
  const recordCall = (
    status: 'success' | 'error',
    usage?: Record<string, unknown>,
    finishReason?: string,
  ) => {
    if (telemetryRecorded) return;
    telemetryRecorded = true;
    const promptTokens = Number(usage?.prompt_tokens || 0);
    const completionTokens = Number(usage?.completion_tokens || 0);
    recordAssessmentModelCall({
      label: requestLabel || 'unlabelled',
      provider: providerName,
      model,
      status,
      durationMs: Date.now() - startedAt,
      promptTokens,
      completionTokens,
      totalTokens: Number(usage?.total_tokens || promptTokens + completionTokens),
      finishReason,
    });
  };
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const maxTokens = Number(process.env.ASSESSMENT_LLM_MAX_TOKENS || 12000);
  if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0) {
    throw new Error('ASSESSMENT_LLM_MAX_TOKENS must be a positive integer.');
  }
  let reservation: CostReservation | undefined;
  if (costBudget) {
    reservation = costBudget.reserve(
      requestLabel || 'unlabelled',
      maximumRequestUsage(messages, maxTokens),
    );
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(Number(process.env.ASSESSMENT_LLM_TIMEOUT_MS || 180000)),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: Number(process.env.ASSESSMENT_LLM_TEMPERATURE || 0.35),
        [maxTokensField]: maxTokens,
        ...(reasoning
          ? {
              thinking: { type: reasoning.enabled ? 'enabled' : 'disabled' },
              ...(reasoning.enabled ? { reasoning_effort: reasoning.effort || 'high' } : {}),
            }
          : {}),
      }),
    });
  } catch (error) {
    if (reservation) costBudget?.reconcile(reservation);
    recordCall('error');
    const message = error instanceof Error ? error.message : String(error);
    throw new AssessmentProviderError(`${providerName} request failed: ${message}`);
  }

  if (!response.ok) {
    if (reservation) costBudget?.reconcile(reservation);
    recordCall('error');
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).error?.message || text;
    } catch {
      // Preserve a non-JSON provider error without exposing request data.
    }
    throw new AssessmentProviderError(`${providerName} API Error: ${response.status} - ${message}`, response.status);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (reservation) costBudget?.reconcile(reservation);
    recordCall('error');
    throw new AssessmentProviderError(`${providerName} returned an invalid response body.`);
  }
  const providerUsage = usageFromProvider(data.usage);
  const requestCostUsd = reservation ? costBudget?.reconcile(reservation, providerUsage) : undefined;
  if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || costBudget) {
    const usage = data.usage || {};
    console.info('[assessment-llm-usage]', JSON.stringify({
      label: requestLabel || 'unlabelled',
      provider: providerName,
      model,
      durationMs: Date.now() - startedAt,
      promptTokens: Number(usage.prompt_tokens || 0),
      completionTokens: Number(usage.completion_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      cacheHitTokens: Number(usage.prompt_cache_hit_tokens || 0),
      cacheMissTokens: Number(usage.prompt_cache_miss_tokens || 0),
      reasoningTokens: Number(usage.completion_tokens_details?.reasoning_tokens || 0),
      ...(requestCostUsd === undefined ? {} : { costUsd: requestCostUsd }),
      ...(costBudget ? { benchmarkCost: costBudget.snapshot() } : {}),
    }));
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    recordCall('error', data.usage, data.choices?.[0]?.finish_reason);
    throw new AssessmentProviderError(`${providerName} did not return message content.`);
  }

  try {
    const parsed = extractJSON(content) as T;
    recordCall('success', data.usage, data.choices?.[0]?.finish_reason);
    return parsed;
  } catch {
    recordCall('error', data.usage, data.choices?.[0]?.finish_reason);
    console.error(`Failed to parse ${providerName} JSON response.`);
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
    const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
    throw new AssessmentProviderError(
      `${providerName} did not return valid JSON for ${requestLabel || 'unlabelled'} `
      + `(finishReason=${finishReason}, contentChars=${content.length}, `
      + `reasoningChars=${typeof reasoningContent === 'string' ? reasoningContent.length : 0}).`,
    );
  }
}

export async function generateAssessmentJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  requestLabel?: string,
): Promise<T> {
  const provider = process.env.ASSESSMENT_LLM_PROVIDER?.toLowerCase() || 'grok';

  if (provider === 'grok') {
    if (!process.env.GROK_API_KEY) throw new AssessmentProviderError('Missing GROK_API_KEY environment variable.');
    return generateJSONWithProvider<T>({
      apiKey: process.env.GROK_API_KEY,
      endpoint: 'https://api.x.ai/v1/chat/completions',
      model: process.env.GROK_MODEL || 'grok-4.3',
      systemPrompt,
      userPrompt,
      providerName: 'Grok',
      requestLabel,
    });
  }

  if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const deterministicPass = requestLabel?.startsWith('decomposition')
      || requestLabel?.startsWith('segmentation-audit')
      || requestLabel?.startsWith('information-unit-map')
      || requestLabel?.includes('evidence-verifier')
      || requestLabel?.startsWith('verified-comparison');
    return generateJSONWithProvider<T>({
      apiKey: process.env.DEEPSEEK_API_KEY,
      endpoint: 'https://api.deepseek.com/chat/completions',
      model,
      systemPrompt,
      userPrompt,
      providerName: 'DeepSeek',
      requestLabel,
      reasoning: {
        enabled: process.env.DEEPSEEK_REASONING_ENABLED === 'true' && !deterministicPass,
        effort: process.env.DEEPSEEK_REASONING_EFFORT === 'max' ? 'max' : 'high',
      },
      costBudget: deepSeekBenchmarkBudget(model),
    });
  }

  if (provider === 'mimo' && process.env.MIMO_API_KEY) {
    const model = process.env.MIMO_MODEL || 'mimo-v2.5';
    const deterministicPass = requestLabel?.includes('evidence-verifier')
      || requestLabel?.startsWith('decomposition');
    return generateJSONWithProvider<T>({
      apiKey: process.env.MIMO_API_KEY,
      endpoint: process.env.MIMO_BASE_URL
        ? `${process.env.MIMO_BASE_URL.replace(/\/$/, '')}/chat/completions`
        : 'https://api.xiaomimimo.com/v1/chat/completions',
      model,
      systemPrompt,
      userPrompt,
      providerName: 'MiMo',
      requestLabel,
      reasoning: {
        enabled: process.env.MIMO_REASONING_ENABLED === 'true' && !deterministicPass,
      },
      costBudget: mimoBenchmarkBudget(model),
      maxTokensField: 'max_completion_tokens',
    });
  }

  throw new AssessmentProviderError(`Unsupported or unconfigured assessment provider: ${provider}.`);
}
