/**
 * Shared-store safeguards on Upstash Redis: a per-client sliding window, a
 * whole-app daily ceiling, and a short-lived answer cache. Rate limiting fails
 * closed — if the store is slow or down, the request is refused, never waved through.
 */
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import { SERVER_CONFIG } from './config.js';

export interface LimitDecision {
  readonly allowed: boolean;
  readonly reason: 'ok' | 'client' | 'daily' | 'unavailable';
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

const deny = (reason: LimitDecision['reason'], window: Window): LimitDecision => ({
  allowed: false,
  reason,
  limit: window.limit,
  remaining: 0,
  resetMs: window.reset,
});

/** Per-client and daily limits in Redis (no in-memory state across requests). O(1) round trips. */
export function upstashLimiter(redis: Redis): Limiter {
  const common = {
    redis,
    ephemeralCache: false,
    timeout: SERVER_CONFIG.limiterTimeoutMs,
    analytics: false,
  } as const;
  const { rateLimit, dailyLimit, keyPrefix } = SERVER_CONFIG;
  const perClient = new Ratelimit({
    ...common,
    prefix: `${keyPrefix}:rl:client`,
    limiter: Ratelimit.slidingWindow(rateLimit.requests, rateLimit.window),
  });
  const daily = new Ratelimit({
    ...common,
    prefix: `${keyPrefix}:rl:daily`,
    limiter: Ratelimit.fixedWindow(dailyLimit.requests, dailyLimit.window),
  });
  return {
    async check(clientKey) {
      try {
        const client = await decide(perClient, clientKey);
        if (client === null) return UNAVAILABLE;
        if (!client.success) return deny('client', client);
        const app = await decide(daily, 'all');
        if (app === null) return UNAVAILABLE;
        if (!app.success) return deny('daily', app);
        const { limit, remaining, reset } = client;
        return { allowed: true, reason: 'ok', limit, remaining, resetMs: reset };
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
