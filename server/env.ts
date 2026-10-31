/**
 * Server environment, validated once. Missing AI or store settings are not
 * errors: the function then answers 503 and the app uses its built-in rules.
 */
import { z } from 'zod';
import { SERVER_CONFIG } from './config.js';

const optional = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const EnvSchema = z.object({
  GEMINI_API_KEY: optional,
  GEMINI_MODELS: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  KV_REST_API_URL: optional,
  KV_REST_API_TOKEN: optional,
  RATE_LIMIT_SALT: optional,
});

export interface ServerEnv {
  readonly geminiApiKey: string | null;
  readonly models: readonly string[];
  readonly redis: { readonly url: string; readonly token: string } | null;
  readonly salt: string;
}

const MODEL_ID = /^[a-z0-9][a-z0-9.-]{2,60}$/u;

type ParsedEnv = z.infer<typeof EnvSchema>;

function modelsFrom(list: string | undefined): readonly string[] {
  const models = (list ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => MODEL_ID.test(id));
  return models.length > 0 ? models : SERVER_CONFIG.defaultModels;
}

/** Upstash names first, then the names the Vercel Marketplace integration sets. */
function redisFrom(env: ParsedEnv): ServerEnv['redis'] {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url !== undefined && token !== undefined ? { url, token } : null;
}

/** Reads the settings this function needs; never throws on missing values. O(1). */
export function readEnv(source: Readonly<Record<string, string | undefined>>): ServerEnv {
  const env = EnvSchema.parse(source);
  const redis = redisFrom(env);
  return {
    geminiApiKey: env.GEMINI_API_KEY ?? null,
    models: modelsFrom(env.GEMINI_MODELS),
    redis,
    // The salt must be secret, or hashed IPs could be reversed by brute force.
    // Without RATE_LIMIT_SALT the store's token (also a secret) is used; with no
    // store there is no limiter and no hashing.
    salt: env.RATE_LIMIT_SALT ?? redis?.token ?? '',
  };
}
