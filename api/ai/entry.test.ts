import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveDeps } from '../../server/deps.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Vercel entry /api/ai/[task]', () => {
  it('exports a fetch handler that refuses GET', async () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const entry = await import('./[task].js');
    const response = await entry.default.fetch(new Request('https://bandobast.test/api/ai/change'));
    expect(response.status).toBe(405);
  });

  it('answers 503 with fallback when the deployment has no AI settings', async () => {
    for (const name of ['GEMINI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']) {
      vi.stubEnv(name, '');
    }
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const entry = await import('./[task].js');
    const response = await entry.default.fetch(
      new Request('https://bandobast.test/api/ai/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://bandobast.test' },
        body: JSON.stringify({ text: 'Wedding in Pune', today: '2026-10-31' }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ fallback: true });
    const line = String(write.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(line)).toMatchObject({
      task: 'intake',
      status: 503,
      outcome: 'not-configured',
    });
    expect(line).not.toContain('Pune');
  });
});

describe('liveDeps', () => {
  it('wires Gemini and Upstash only when both are configured, without network calls', () => {
    const empty = liveDeps({});
    expect([empty.callModel, empty.limiter, empty.cache]).toEqual([null, null, null]);
    const full = liveDeps({
      GEMINI_API_KEY: 'test-key',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(typeof full.callModel).toBe('function');
    expect(full.limiter).not.toBe(null);
    expect(full.cache).not.toBe(null);
  });
});
