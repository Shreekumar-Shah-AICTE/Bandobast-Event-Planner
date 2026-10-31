/**
 * Browser side of /api/ai/:task. Every answer is validated again here; any
 * failure becomes a reason, and callers fall back to the built-in rules.
 */
import { z } from 'zod';
import {
  AI_CONTRACTS,
  type AiInput,
  type AiOutput,
  type AiTask,
} from '../../shared/aiContracts.js';
import { AI_TIMING } from '../../shared/timing.js';

export type AiFailure =
  'offline' | 'unavailable' | 'limited' | 'rejected' | 'invalid' | 'timeout' | 'aborted';

export type AiResult<T extends AiTask> =
  | { readonly ok: true; readonly data: AiOutput<T>; readonly model: string }
  | { readonly ok: false; readonly reason: AiFailure };

/** Longest model name accepted from the server. */
const MAX_MODEL_NAME = 80;
const HTTP = { tooMany: 429, badGateway: 502, unavailable: 503 } as const;

/** One signal that aborts when any of the given signals does. O(n). */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', () => {
      controller.abort();
    });
  }
  return controller.signal;
}

const reasonFor = (status: number): AiFailure => {
  if (status === HTTP.tooMany) return 'limited';
  if (status === HTTP.unavailable) return 'unavailable';
  return status === HTTP.badGateway ? 'invalid' : 'rejected';
};

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function readResponse<T extends AiTask>(task: T, response: Response): Promise<AiResult<T>> {
  if (!response.ok) return { ok: false, reason: reasonFor(response.status) };
  const envelope = z
    .object({
      ok: z.literal(true),
      data: AI_CONTRACTS[task].output,
      model: z.string().max(MAX_MODEL_NAME),
    })
    .safeParse(await readJson(response));
  if (!envelope.success) return { ok: false, reason: 'invalid' };
  return { ok: true, data: envelope.data.data as AiOutput<T>, model: envelope.data.model };
}

/** Asks the AI function; never throws. Times out after {@link AI_TIMING.clientTimeoutMs}. */
export async function askAi<T extends AiTask>(
  task: T,
  input: AiInput<T>,
  signal: AbortSignal,
): Promise<AiResult<T>> {
  const timeout = AbortSignal.timeout(AI_TIMING.clientTimeoutMs);
  let response: Response;
  try {
    response = await fetch(`/api/ai/${task}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: anySignal([signal, timeout]),
    });
  } catch {
    if (signal.aborted) return { ok: false, reason: 'aborted' };
    return { ok: false, reason: timeout.aborted ? 'timeout' : 'offline' };
  }
  return readResponse(task, response);
}

/** Plain-language note shown when the built-in rules answered instead. */
export const FALLBACK_NOTES: Readonly<Record<AiFailure, string>> = {
  offline: 'You seem to be offline, so the built-in rules read this.',
  unavailable: 'The AI is not available right now, so the built-in rules read this.',
  limited: 'Too many AI requests for now, so the built-in rules read this.',
  rejected: 'The AI could not take this request, so the built-in rules read this.',
  invalid: "The AI's answer failed our checks, so the built-in rules read this.",
  timeout: 'The AI took too long, so the built-in rules read this.',
  aborted: 'Cancelled.',
};
