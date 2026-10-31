import { describe, expect, it } from 'vitest';
import { readEnv } from './env.js';

describe('readEnv', () => {
  it('treats missing and blank settings as not configured', () => {
    for (const source of [{}, { GEMINI_API_KEY: '  ', UPSTASH_REDIS_REST_URL: '' }]) {
      expect(readEnv(source)).toEqual({
        geminiApiKey: null,
        models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
        redis: null,
        salt: '',
      });
    }
  });

  it('keeps only well-formed model ids, in order', () => {
    expect(readEnv({ GEMINI_MODELS: 'gemini-x-flash, Bad Model!, gemini-y-lite' }).models).toEqual([
      'gemini-x-flash',
      'gemini-y-lite',
    ]);
    expect(readEnv({ GEMINI_MODELS: ' , ' }).models).toHaveLength(2);
  });

  it('prefers Upstash names and accepts the Vercel Marketplace names', () => {
    const upstash = { UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't1' };
    const kv = { KV_REST_API_URL: 'https://kv', KV_REST_API_TOKEN: 't2' };
    expect(readEnv({ ...kv, ...upstash }).redis).toEqual({ url: 'https://u', token: 't1' });
    expect(readEnv(kv).redis).toEqual({ url: 'https://kv', token: 't2' });
    expect(readEnv({ KV_REST_API_URL: 'https://kv' }).redis).toBe(null);
  });

  it('reads the key and a secret salt, defaulting to the store token', () => {
    expect(readEnv({ GEMINI_API_KEY: 'k', RATE_LIMIT_SALT: 's' })).toMatchObject({
      geminiApiKey: 'k',
      salt: 's',
    });
    const store = { KV_REST_API_URL: 'https://kv', KV_REST_API_TOKEN: 'secret-token' };
    expect(readEnv(store).salt).toBe('secret-token');
  });
});
