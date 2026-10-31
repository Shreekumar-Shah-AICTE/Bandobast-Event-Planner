import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../src/domain/result.js';
import { firstValid, geminiCaller, type AttemptParams, type ModelCall } from './model.js';

const calls = vi.hoisted(() => [] as unknown[]);

vi.mock('@google/genai', () => ({
  ThinkingLevel: { LOW: 'LOW' },
  GoogleGenAI: class {
    readonly models = {
      generateContent: (params: { contents: string }) => {
        calls.push(params);
        return Promise.resolve({ text: params.contents === 'empty' ? undefined : '{"a":1}' });
      },
    };
  },
}));

const REQUEST = { system: 'sys', prompt: 'hello', schema: { type: 'object' }, maxOutputTokens: 99 };

describe('geminiCaller', () => {
  it('asks for JSON with the schema, low temperature, low thinking and a timeout signal', async () => {
    const signal = AbortSignal.timeout(1_000);
    const call = geminiCaller('key');
    expect(await call('gemini-test', { ...REQUEST, signal })).toBe('{"a":1}');
    expect(calls[0]).toEqual({
      model: 'gemini-test',
      contents: 'hello',
      config: {
        systemInstruction: 'sys',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        temperature: 0.2,
        maxOutputTokens: 99,
        thinkingConfig: { thinkingLevel: 'LOW' },
        abortSignal: signal,
      },
    });
    expect(await call('gemini-test', { ...REQUEST, prompt: 'empty', signal })).toBe('');
  });
});

const params = (call: ModelCall, models = ['m1', 'm2']): AttemptParams => ({
  models,
  call,
  request: REQUEST,
  accept: (answer) => {
    if (typeof answer !== 'object' || answer === null) return err('schema');
    return 'bad' in answer ? err('guard') : ok(answer);
  },
  timeoutMs: 20,
});

describe('firstValid', () => {
  it('stops at the first valid answer', async () => {
    const call = vi.fn<ModelCall>(() => Promise.resolve('{"good":true}'));
    expect(await firstValid(params(call))).toEqual([
      { outcome: 'ok', model: 'm1', value: { good: true } },
    ]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('records why each model failed and tries at most two', async () => {
    const replies = ['"text"', '{"bad":1}'];
    const call = vi.fn<ModelCall>(() => Promise.resolve(replies.shift() ?? '{}'));
    const attempts = await firstValid(params(call, ['m1', 'm2', 'm3']));
    expect(attempts.map((entry) => entry.outcome)).toEqual(['schema', 'guard']);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('separates errors from timeouts, even when a call ignores its signal', async () => {
    const replies: (() => Promise<string>)[] = [
      () => Promise.reject(new Error('quota')),
      () => new Promise<string>(() => undefined),
    ];
    const call = vi.fn<ModelCall>(() => replies.shift()!());
    const attempts = await firstValid(params(call));
    expect(attempts.map((entry) => entry.outcome)).toEqual(['error', 'timeout']);
  });
});
