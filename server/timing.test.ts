import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AI_TIMING } from '../shared/timing.js';
import { SERVER_CONFIG } from './config.js';
import { LIMIT_CHECKS } from './store.js';

const VercelSchema = z.object({
  functions: z.record(z.string(), z.object({ maxDuration: z.number() })),
});
const vercel = VercelSchema.parse(JSON.parse(readFileSync('vercel.json', 'utf8')));
const MS = 1000;

describe('one time budget per AI request', () => {
  const { timing, limiterTimeoutMs, maxModelAttempts } = SERVER_CONFIG;

  it('lets the layers give up in order: server, then browser, then platform', () => {
    expect(AI_TIMING.serverBudgetMs).toBeLessThan(AI_TIMING.clientTimeoutMs);
    expect(AI_TIMING.clientTimeoutMs).toBeLessThan(AI_TIMING.functionMaxDurationS * MS);
    expect(vercel.functions['api/ai/[task].ts']?.maxDuration).toBe(AI_TIMING.functionMaxDurationS);
  });

  it('fits every rate-limit check, a cache read, a full model call and a cache write', () => {
    expect(LIMIT_CHECKS).toHaveLength(3);
    const beforeModels = LIMIT_CHECKS.length * limiterTimeoutMs + timing.storeTimeoutMs;
    expect(beforeModels + timing.modelTimeoutMs + timing.storeTimeoutMs).toBeLessThanOrEqual(
      timing.serverBudgetMs,
    );
    expect(maxModelAttempts * timing.modelTimeoutMs).toBeLessThan(timing.serverBudgetMs);
    expect(timing.minAttemptMs).toBeLessThan(timing.modelTimeoutMs);
  });
});
