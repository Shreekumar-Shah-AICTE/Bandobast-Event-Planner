/**
 * Gemini calls with structured JSON output. Each attempt has its own timeout;
 * a failed, invalid or ungrounded answer moves on to the next model in the chain.
 */
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Result } from '../src/domain/result.js';
import { SERVER_CONFIG } from './config.js';

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

/** The real Gemini caller (low temperature, low thinking, JSON only). */
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

export type AttemptOutcome = 'ok' | 'error' | 'timeout' | 'json' | 'schema' | 'guard';

export interface Attempt {
  readonly outcome: AttemptOutcome;
  readonly model: string;
  readonly value?: unknown;
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
  readonly timeoutMs: number;
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

async function attempt(model: string, params: AttemptParams): Promise<Attempt> {
  const signal = AbortSignal.timeout(params.timeoutMs);
  let text: string;
  try {
    text = await Promise.race([
      params.call(model, { ...params.request, signal }),
      whenAborted(signal),
    ]);
  } catch {
    return { outcome: signal.aborted ? 'timeout' : 'error', model };
  }
  const data = parseJson(text);
  if (data === undefined) return { outcome: 'json', model };
  const checked = params.accept(data);
  return checked.ok
    ? { outcome: 'ok', model, value: checked.value }
    : { outcome: checked.error, model };
}

/** Tries up to two models in order and returns every attempt (the last one may be ok). */
export async function firstValid(params: AttemptParams): Promise<readonly Attempt[]> {
  const attempts: Attempt[] = [];
  for (const model of params.models.slice(0, SERVER_CONFIG.maxModelAttempts)) {
    const result = await attempt(model, params);
    attempts.push(result);
    if (result.outcome === 'ok') break;
  }
  return attempts;
}
