/** Tunables for the AI function, in one place. Values are deliberate, not magic. */
import { AI_TIMING } from '../shared/timing.js';

export const SERVER_CONFIG = {
  /** Largest accepted request body; the biggest input (a pasted quote) is 4,000 characters. */
  maxBodyBytes: 16 * 1024,
  /** At most this many models are tried per request. */
  maxModelAttempts: 2,
  /** Low temperature: extraction and short ideas, not creative writing. */
  temperature: 0.2,
  /**
   * Output token caps per task (they include the model's low-level thinking).
   * They bound latency and cost; a typical answer uses a fraction of them.
   */
  maxOutputTokens: { intake: 2048, change: 2048, quote: 3072, ideas: 3072, explain: 1536 },
  /** Per-client sliding window. */
  rateLimit: { requests: 12, window: '60 s' },
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
  defaultModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
} as const;
