/**
 * Gemini calls with structured JSON output. All attempts share one deadline;
 * a failed, invalid or ungrounded answer moves on to the next model in the chain
 * if enough time is left.
 */
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Result } from '../src/domain/result.js';
import { SERVER_CONFIG } from './config.js';

/**
 * One structured-output call: the system instruction, the prompt, the JSON Schema for the answer,
 * an output token cap and a cancel signal.
 */
export interface ModelRequest {
  readonly system: string;
  readonly prompt: string;
  /** JSON Schema for the response (from zod). */
  readonly schema: unknown;
  readonly maxOutputTokens: number;
  readonly signal: AbortSignal;
}

/** Calls one model and returns its raw text. */
export type ModelCall = (model: string, request: ModelRequest) => Promise<string>;

/** The real Gemini caller (default temperature, low thinking, JSON only). */
export function geminiCaller(apiKey: string): ModelCall {
  const ai = new GoogleGenAI({ apiKey });
  return async (model, request) => {
    const response = await ai.models.generateContent({
      model,
      contents: request.prompt,
      config: {
        systemInstruction: request.system,
        responseMimeType: 'application/json',
        responseJsonSchema: request.schema,
        temperature: SERVER_CONFIG.temperature,
        maxOutputTokens: request.maxOutputTokens,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: request.signal,
      },
    });
    return response.text ?? '';
  };
}

/** `budget`: not tried, because too little of the request's time was left. */
export type AttemptOutcome = 'ok' | 'error' | 'timeout' | 'json' | 'schema' | 'guard' | 'budget';

/**
 * What one model in the cascade returned: its outcome, its name and, on success, the parsed value.
 */
export interface Attempt {
  readonly outcome: AttemptOutcome;
  readonly model: string;
  readonly value?: unknown;
  /** HTTP status of a provider error (for example 429 or 400), for the logs. */
  readonly status?: number;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Parameters for {@link firstValid}. */
export interface AttemptParams {
  readonly models: readonly string[];
  readonly call: ModelCall;
  readonly request: Omit<ModelRequest, 'signal'>;
  /** Output schema and code checks; an error names which one failed. */
  readonly accept: (answer: unknown) => Result<unknown, 'schema' | 'guard'>;
  /** Longest single call. */
  readonly timeoutMs: number;
  /** No call is started with less time than this left before the deadline. */
  readonly minAttemptMs: number;
  /** Clock time by which every attempt has ended. */
  readonly deadline: number;
  readonly now: () => number;
}

/** Rejects when the signal aborts, so a call that ignores its signal still ends on time. */
const whenAborted = (signal: AbortSignal): Promise<never> =>
  new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(new Error('Model call timed out.'));
      },
      { once: true },
    );
  });

const statusOf = (error: unknown): { status?: number } =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? { status: error.status }
    : {};

async function attempt(model: string, params: AttemptParams, timeoutMs: number): Promise<Attempt> {
  const signal = AbortSignal.timeout(timeoutMs);
  let text: string;
  try {
    text = await Promise.race([
      params.call(model, { ...params.request, signal }),
      whenAborted(signal),
    ]);
  } catch (error) {
    return { outcome: signal.aborted ? 'timeout' : 'error', model, ...statusOf(error) };
  }
  const data = parseJson(text);
  if (data === undefined) return { outcome: 'json', model };
  const checked = params.accept(data);
  return checked.ok
    ? { outcome: 'ok', model, value: checked.value }
    : { outcome: checked.error, model };
}

/**
 * Tries up to two models in order within the deadline and returns every attempt
 * (the last one may be ok). O(models).
 */
export async function firstValid(params: AttemptParams): Promise<readonly Attempt[]> {
  const attempts: Attempt[] = [];
  for (const model of params.models.slice(0, SERVER_CONFIG.maxModelAttempts)) {
    const timeoutMs = Math.min(params.timeoutMs, params.deadline - params.now());
    const result =
      timeoutMs < params.minAttemptMs
        ? { outcome: 'budget' as const, model }
        : await attempt(model, params, timeoutMs);
    attempts.push(result);
    if (result.outcome === 'ok' || result.outcome === 'budget') break;
  }
  return attempts;
}
