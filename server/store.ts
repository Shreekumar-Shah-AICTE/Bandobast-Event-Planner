/**
 * Shared-store safeguards on Upstash Redis: a per-client sliding window, a
 * per-client daily cap, a whole-app daily ceiling, and a short-lived answer cache. Rate limiting fails
 * closed — if the store is slow or down, the request is refused, never waved through.
 */
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import { SERVER_CONFIG } from './config.js';

export interface LimitDecision {
  readonly allowed: boolean;
  readonly reason: 'ok' | 'client' | 'client-daily' | 'daily' | 'unavailable';
  readonly limit: number;
  readonly remaining: number;
  /** Unix time in ms when the window resets. */
  readonly resetMs: number;
}

export interface Limiter {
  check(clientKey: string): Promise<LimitDecision>;
}

export interface AnswerCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const UNAVAILABLE: LimitDecision = {
  allowed: false,
  reason: 'unavailable',
  limit: 0,
  remaining: 0,
  resetMs: 0,
};

type Window = Awaited<ReturnType<Ratelimit['limit']>>;

/** Upstash reports a store timeout as `success: true`; treat it as a refusal. */
async function decide(limiter: Ratelimit, key: string): Promise<Window | null> {
  const result = await limiter.limit(key);
  await result.pending;
  return result.reason === 'timeout' ? null : result;
}

const allow = (window: Window): LimitDecision => ({
  allowed: true,
  reason: 'ok',
  limit: window.limit,
  remaining: window.remaining,
  resetMs: window.reset,
});

const deny = (reason: LimitDecision['reason'], window: Window): LimitDecision => ({
  allowed: false,
  reason,
  limit: window.limit,
  remaining: 0,
  resetMs: window.reset,
});

/**
 * The limits each AI request passes, in this order, one Redis round trip each. The
 * cheapest refusal comes first, so a client over its own limit never uses up the
 * whole app's daily ceiling. `server/timing.test.ts` budgets one timeout per check.
 */
export const LIMIT_CHECKS = ['client', 'client-daily', 'daily'] as const;
type LimitCheck = (typeof LIMIT_CHECKS)[number];

/** Per-client, per-client daily and whole-app daily limits in Redis (no in-memory state). O(1) round trips. */
export function upstashLimiter(redis: Redis): Limiter {
  const common = {
    redis,
    ephemeralCache: false,
    timeout: SERVER_CONFIG.limiterTimeoutMs,
    analytics: false,
  } as const;
  const { rateLimit, clientDailyLimit, dailyLimit, keyPrefix } = SERVER_CONFIG;
  const perClient = new Ratelimit({
    ...common,
    prefix: `${keyPrefix}:rl:client`,
    limiter: Ratelimit.slidingWindow(rateLimit.requests, rateLimit.window),
  });
  const perClientDaily = new Ratelimit({
    ...common,
    prefix: `${keyPrefix}:rl:client-day`,
    limiter: Ratelimit.fixedWindow(clientDailyLimit.requests, clientDailyLimit.window),
  });
  const daily = new Ratelimit({
    ...common,
    prefix: `${keyPrefix}:rl:daily`,
    limiter: Ratelimit.fixedWindow(dailyLimit.requests, dailyLimit.window),
  });
  const limiters: Record<LimitCheck, Ratelimit> = {
    client: perClient,
    'client-daily': perClientDaily,
    daily,
  };
  return {
    async check(clientKey) {
      try {
        let decision = UNAVAILABLE;
        // In order, on purpose: a refused check must not use up the later limits.
        for (const name of LIMIT_CHECKS) {
          const window = await decide(limiters[name], name === 'daily' ? 'all' : clientKey);
          if (window === null) return UNAVAILABLE;
          if (!window.success) return deny(name, window);
          // The client's own window is what the response headers report.
          if (name === 'client') decision = allow(window);
        }
        return decision;
      } catch {
        return UNAVAILABLE;
      }
    },
  };
}

/** Best-effort answer cache: a miss or a store error only costs a model call. O(1). */
export function upstashCache(redis: Redis): AnswerCache {
  const prefix = `${SERVER_CONFIG.keyPrefix}:answer:`;
  return {
    async get(key) {
      try {
        return await redis.get(prefix + key);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        await redis.set(prefix + key, value, { ex: SERVER_CONFIG.cacheTtlSeconds });
      } catch {
        // A failed write only means the next identical request asks the model again.
      }
    },
  };
}

const HEX = 16;

/** SHA-256 hex of the joined parts (Web Crypto). Used for client keys and cache keys. O(n). */
export async function sha256(...parts: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join('\u0000'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(HEX).padStart(2, '0')).join('');
}
