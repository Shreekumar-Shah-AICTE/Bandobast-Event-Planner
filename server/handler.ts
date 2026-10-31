/**
 * POST /api/ai/:task. Order: request checks → input schema → rate limit (shared
 * store, fails closed) → answer cache → model chain with output schema and code
 * checks. Every failure tells the client whether to fall back to its rules, and
 * the whole request fits one time budget (shared/timing.ts).
 */
import { AiTaskSchema, CACHED_MODEL, type AiTask } from '../shared/aiContracts.js';
import type { ServerEnv } from './env.js';
import { STATUS, fail, json } from './http.js';
import type { Logger } from './log.js';
import { firstValid, type Attempt, type ModelCall } from './model.js';
import { PROMPT_VERSION, SYSTEM_INSTRUCTION } from './prompts.js';
import { checkRequest, clientKey, readBody } from './request.js';
import { sha256, type AnswerCache, type LimitDecision, type Limiter } from './store.js';
import { TASKS, type PreparedTask } from './tasks.js';
import { within } from './time.js';

/** Time limits for one request (tests shorten them). */
export interface Timing {
  readonly serverBudgetMs: number;
  readonly modelTimeoutMs: number;
  readonly minAttemptMs: number;
  readonly storeTimeoutMs: number;
}

export interface HandlerDeps {
  readonly env: ServerEnv;
  readonly limiter: Limiter | null;
  readonly cache: AnswerCache | null;
  readonly callModel: ModelCall | null;
  readonly log: Logger;
  readonly now: () => number;
  readonly timing: Timing;
}

const MS_PER_SECOND = 1000;

function limitHeaders(decision: LimitDecision, now: number): Record<string, string> {
  const seconds = Math.max(1, Math.ceil((decision.resetMs - now) / MS_PER_SECOND));
  return {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(decision.remaining),
    'RateLimit-Reset': String(seconds),
    ...(decision.allowed ? {} : { 'Retry-After': String(seconds) }),
  };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

/** Dependencies once the AI is known to be configured. */
interface LiveDeps extends HandlerDeps {
  readonly limiter: Limiter;
  readonly callModel: ModelCall;
}

/** Builds the request handler around injected stores, model and logger. */
export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const started = deps.now();
    const name = new URL(request.url).pathname.replace(/^.*\//u, '');
    const task = AiTaskSchema.safeParse(name);
    const done = (response: Response, outcome: string, model?: string): Response => {
      deps.log({
        task: task.success ? task.data : 'unknown',
        status: response.status,
        outcome,
        ms: deps.now() - started,
        ...(model === undefined ? {} : { model }),
      });
      return response;
    };
    if (!task.success)
      return done(fail(STATUS.notFound, 'Unknown task.', { fallback: false }), 'unknown-task');
    const rejected = checkRequest(request);
    if (rejected !== null) return done(rejected, 'rejected');
    const body = await readBody(request);
    if (body === null)
      return done(fail(STATUS.tooLarge, 'Request too large.', { fallback: false }), 'too-large');
    const job = TASKS[task.data](parseJson(body));
    if (job === null)
      return done(fail(STATUS.badRequest, 'Invalid input.', { fallback: true }), 'invalid-input');
    const { limiter, callModel } = deps;
    if (callModel === null || limiter === null) {
      return done(
        fail(STATUS.unavailable, 'AI is not configured; using built-in rules.'),
        'not-configured',
      );
    }
    const live: LiveDeps = { ...deps, limiter, callModel };
    return done(...(await serve({ task: task.data, job, request, started }, live)));
  };
}

interface Job {
  readonly task: AiTask;
  readonly job: PreparedTask;
  readonly request: Request;
  readonly started: number;
}

type Reply = [Response, string, string?];
type HeaderMap = Record<string, string>;

async function serve(job: Job, deps: LiveDeps): Promise<Reply> {
  const decision = await deps.limiter.check(await clientKey(job.request, deps.env.salt));
  const headers = limitHeaders(decision, deps.now());
  return blockedBy(decision, headers) ?? answer(job, deps, headers);
}

function blockedBy(decision: LimitDecision, headers: HeaderMap): Reply | null {
  if (decision.reason === 'unavailable') {
    return [
      fail(STATUS.unavailable, 'AI is busy; using built-in rules.', { headers }),
      'limiter-unavailable',
    ];
  }
  if (!decision.allowed) {
    return [
      fail(STATUS.tooMany, 'Too many AI requests; using built-in rules.', { headers }),
      `limited-${decision.reason}`,
    ];
  }
  return null;
}

/** "model:outcome" per attempt, with the provider's status code when there was one. */
const describe = (attempts: readonly Attempt[]): string =>
  attempts
    .map(({ model, outcome, status }) =>
      status === undefined ? `${model}:${outcome}` : `${model}:${outcome}-${String(status)}`,
    )
    .join(',');

async function answer(
  { task, job, started }: Job,
  deps: LiveDeps,
  headers: HeaderMap,
): Promise<Reply> {
  const { timing, cache } = deps;
  const key = await sha256(PROMPT_VERSION, task, deps.env.models.join(','), job.inputJson);
  const stored = cache === null ? null : await within(cache.get(key), timing.storeTimeoutMs, null);
  const cached = job.accept(stored);
  if (cached.ok) {
    return [
      json({ ok: true, data: cached.value, model: CACHED_MODEL }, STATUS.ok, headers),
      'cache',
    ];
  }
  const attempts = await firstValid({
    models: deps.env.models,
    call: deps.callModel,
    request: {
      system: SYSTEM_INSTRUCTION,
      prompt: job.prompt,
      schema: job.schema,
      maxOutputTokens: job.maxOutputTokens,
    },
    accept: job.accept,
    timeoutMs: timing.modelTimeoutMs,
    minAttemptMs: timing.minAttemptMs,
    // Leave time to store the answer and reply inside the server budget.
    deadline: started + timing.serverBudgetMs - timing.storeTimeoutMs,
    now: deps.now,
  });
  const last = attempts.at(-1);
  if (last?.outcome !== 'ok') {
    return [
      fail(STATUS.badGateway, 'AI answer failed checks; using built-in rules.', { headers }),
      describe(attempts),
    ];
  }
  if (cache !== null) await within(cache.set(key, last.value), timing.storeTimeoutMs, undefined);
  return [
    json({ ok: true, data: last.value, model: last.model }, STATUS.ok, headers),
    'ok',
    last.model,
  ];
}
