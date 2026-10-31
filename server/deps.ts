/** Production wiring: Upstash Redis for limits and cache, Gemini for answers. */
import { Redis } from '@upstash/redis';
import { SERVER_CONFIG } from './config.js';
import { readEnv } from './env.js';
import type { HandlerDeps } from './handler.js';
import { stdoutLogger } from './log.js';
import { geminiCaller } from './model.js';
import { upstashCache, upstashLimiter } from './store.js';

/** Builds live dependencies from environment variables (no network calls until a request). */
export function liveDeps(source: Readonly<Record<string, string | undefined>>): HandlerDeps {
  const env = readEnv(source);
  const redis =
    env.redis === null ? null : new Redis({ url: env.redis.url, token: env.redis.token });
  return {
    env,
    limiter: redis === null ? null : upstashLimiter(redis),
    cache: redis === null ? null : upstashCache(redis),
    callModel: env.geminiApiKey === null ? null : geminiCaller(env.geminiApiKey),
    log: stdoutLogger,
    now: Date.now,
    modelTimeoutMs: SERVER_CONFIG.modelTimeoutMs,
  };
}
