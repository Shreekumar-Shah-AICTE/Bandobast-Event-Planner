/** Tunables for the AI function, in one place. Values are deliberate, not magic. */
import { AI_TIMING } from '../shared/timing.js';

/**
 * Every server-side limit, timeout and model setting in one place. `server/docs.test.ts` checks the
 * numbers the docs quote.
 */
export const SERVER_CONFIG = {
  /** Largest accepted request body; the biggest input (a pasted quote) is 4,000 characters. */
  maxBodyBytes: 16 * 1024,
  /** At most this many models are tried per request. */
  maxModelAttempts: 2,
  /**
   * The Gemini 3 default. Google advises against lowering it for Gemini 3 models (it can cause
   * looping); steadiness comes from the JSON schema, low thinking and the code checks instead.
   */
  temperature: 1,
  /**
   * Output token caps per task (they include the model's low-level thinking).
   * They bound latency and cost; a typical answer uses a fraction of them.
   */
  maxOutputTokens: { intake: 2048, change: 2048, quote: 3072, ideas: 3072, explain: 1536 },
  /** Per-client sliding window. */
  rateLimit: { requests: 12, window: '60 s' },
  /** Per-client daily cap, so one client cannot use up the whole-app ceiling. */
  clientDailyLimit: { requests: 200, window: '1 d' },
  /** Whole-app daily ceiling protecting the Gemini quota. */
  dailyLimit: { requests: 3000, window: '1 d' },
  /** Rate-limit store calls give up after this long and the request is refused. */
  limiterTimeoutMs: 1_500,
  /** One time budget per request (shared/timing.ts); every wait below fits inside it. */
  timing: {
    serverBudgetMs: AI_TIMING.serverBudgetMs,
    /** Longest single model call; a second model gets whatever budget is left. */
    modelTimeoutMs: 9_000,
    /** A model call is not started with less time than this left. */
    minAttemptMs: 2_000,
    /** Answer-cache reads and writes give up after this long (a miss costs one model call). */
    storeTimeoutMs: 1_000,
  },
  /** Identical requests reuse a validated answer for a day. */
  cacheTtlSeconds: 24 * 60 * 60,
  keyPrefix: 'bandobast',
  /** A model-read event date further out than this is treated as a misread. */
  maxEventDaysAhead: 3 * 366,
  /** Hex characters kept from the salted client-IP hash. */
  clientKeyLength: 32,
  /**
   * Fast model first, larger model second (a cheap-first cascade): the second one is
   * tried only when the first times out, errors or fails a check. On the live app the
   * light model answered every task in about a second; the larger one often needed
   * more than the per-model timeout.
   */
  defaultModels: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'],
} as const;
