/** A fake AI function for UI tests: each request is answered by a handler, per task. */
import { vi } from 'vitest';
import type { AiTask } from '../../shared/aiContracts.js';

export interface FakeReply {
  readonly status: number;
  readonly body: unknown;
}

export type Handler = (task: AiTask, input: unknown) => FakeReply | 'network';

export const aiOk = (data: unknown, model = 'gemini-test'): FakeReply => ({
  status: 200,
  body: { ok: true, data, model },
});

export const aiDown = (): FakeReply => ({
  status: 503,
  body: { ok: false, error: 'unavailable', fallback: true },
});

/** Replaces fetch; returns the mock so tests can read what was sent. */
export function mockAi(handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit): Promise<Response> => {
    const task = url.split('/').at(-1) as AiTask;
    const reply = handler(
      task,
      JSON.parse(typeof init?.body === 'string' ? init.body : 'null') as unknown,
    );
    if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Every task the fake was asked, in order. */
export const tasksAsked = (fetchMock: ReturnType<typeof mockAi>): string[] =>
  fetchMock.mock.calls.map(([url]) => url.split('/').at(-1) ?? '');
