import type { Redis } from '@upstash/redis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256, upstashCache, upstashLimiter } from './store.js';

interface Window {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
  reason?: string;
}

const state = vi.hoisted(() => ({
  configs: [] as { prefix: string; ephemeralCache: unknown; timeout: unknown; limiter: unknown }[],
  replies: new Map<string, () => Promise<Window>>(),
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow(requests: number, window: string) {
      return { kind: 'sliding', requests, window };
    }
    static fixedWindow(requests: number, window: string) {
      return { kind: 'fixed', requests, window };
    }
    private readonly prefix: string;
    constructor(config: (typeof state.configs)[number]) {
      this.prefix = config.prefix;
      state.configs.push(config);
    }
    limit(): Promise<Window> {
      const reply = state.replies.get(this.prefix);
      return reply === undefined ? Promise.reject(new Error('no reply')) : reply();
    }
  },
}));

const CLIENT = 'bandobast:rl:client';
const DAILY = 'bandobast:rl:daily';
const window = (overrides: Partial<Window> = {}): Window => ({
  success: true,
  limit: 12,
  remaining: 11,
  reset: 1_000,
  pending: Promise.resolve(),
  ...overrides,
});
const redis = {} as Redis;

beforeEach(() => {
  state.configs.length = 0;
  state.replies.clear();
});

describe('upstashLimiter', () => {
  it('configures a per-client sliding window and a daily ceiling that never use memory', () => {
    upstashLimiter(redis);
    expect(state.configs.map((config) => config.prefix)).toEqual([CLIENT, DAILY]);
    expect(state.configs[0]).toMatchObject({
      ephemeralCache: false,
      timeout: 1_500,
      limiter: { kind: 'sliding', requests: 12, window: '60 s' },
    });
    expect(state.configs[1]?.limiter).toEqual({ kind: 'fixed', requests: 3_000, window: '1 d' });
  });

  it('allows a request inside both limits and waits for pending writes', async () => {
    let written = false;
    const pending = new Promise<void>((resolve) => {
      setTimeout(() => {
        written = true;
        resolve();
      }, 5);
    });
    state.replies.set(CLIENT, () => Promise.resolve(window({ pending })));
    state.replies.set(DAILY, () => Promise.resolve(window({ limit: 3_000 })));
    const decision = await upstashLimiter(redis).check('client-key');
    expect(decision).toEqual({
      allowed: true,
      reason: 'ok',
      limit: 12,
      remaining: 11,
      resetMs: 1_000,
    });
    expect(written).toBe(true);
  });

  it('names the limit that refused the request', async () => {
    state.replies.set(CLIENT, () => Promise.resolve(window({ success: false, remaining: 0 })));
    expect(await upstashLimiter(redis).check('k')).toMatchObject({
      allowed: false,
      reason: 'client',
    });
    state.replies.set(CLIENT, () => Promise.resolve(window()));
    state.replies.set(DAILY, () => Promise.resolve(window({ success: false, limit: 3_000 })));
    expect(await upstashLimiter(redis).check('k')).toEqual({
      allowed: false,
      reason: 'daily',
      limit: 3_000,
      remaining: 0,
      resetMs: 1_000,
    });
  });

  it('fails closed on a store timeout or error', async () => {
    const unavailable = { allowed: false, reason: 'unavailable' };
    state.replies.set(CLIENT, () => Promise.resolve(window({ reason: 'timeout' })));
    expect(await upstashLimiter(redis).check('k')).toMatchObject(unavailable);
    state.replies.set(CLIENT, () => Promise.resolve(window()));
    state.replies.set(DAILY, () => Promise.resolve(window({ reason: 'timeout' })));
    expect(await upstashLimiter(redis).check('k')).toMatchObject(unavailable);
    state.replies.set(CLIENT, () => Promise.reject(new Error('network')));
    expect(await upstashLimiter(redis).check('k')).toMatchObject(unavailable);
  });
});

describe('upstashCache', () => {
  it('stores answers under a prefix with a one-day expiry', async () => {
    const get = vi.fn(() => Promise.resolve({ ok: 1 }));
    const set = vi.fn(() => Promise.resolve('OK'));
    const cache = upstashCache({ get, set } as unknown as Redis);
    expect(await cache.get('abc')).toEqual({ ok: 1 });
    await cache.set('abc', { ok: 1 });
    expect(get).toHaveBeenCalledWith('bandobast:answer:abc');
    expect(set).toHaveBeenCalledWith('bandobast:answer:abc', { ok: 1 }, { ex: 86_400 });
  });

  it('treats store errors as a miss', async () => {
    const failing = () => Promise.reject(new Error('down'));
    const cache = upstashCache({ get: failing, set: failing } as unknown as Redis);
    expect(await cache.get('abc')).toBe(null);
    await expect(cache.set('abc', 1)).resolves.toBeUndefined();
  });
});

describe('sha256', () => {
  it('matches the standard test vector', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('separates parts so different splits never collide', async () => {
    expect(await sha256('a', 'bc')).not.toBe(await sha256('ab', 'c'));
  });
});
