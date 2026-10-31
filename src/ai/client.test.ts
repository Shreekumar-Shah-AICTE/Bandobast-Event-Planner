import { describe, expect, it, vi } from 'vitest';
import { aiOk, mockAi } from '../test/ai.js';
import { anySignal, askAi } from './client.js';

const changeOut = { changes: [], unparsed: [] };
const input = { text: '50 more guests', today: '2026-10-31', eventType: 'wedding' } as const;
const ask = (signal = new AbortController().signal) => askAi('change', input, signal);

describe('askAi', () => {
  it('returns checked data and the model name', async () => {
    const fetchMock = mockAi(() => aiOk(changeOut, 'gemini-x'));
    await expect(ask()).resolves.toEqual({ ok: true, data: changeOut, model: 'gemini-x' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/ai/change');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual(input);
  });

  it.each([
    [429, 'limited'],
    [503, 'unavailable'],
    [502, 'invalid'],
    [400, 'rejected'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    mockAi(() => ({ status, body: { ok: false, error: 'x', fallback: true } }));
    await expect(ask()).resolves.toEqual({ ok: false, reason });
  });

  it('rejects answers that do not match the contract', async () => {
    mockAi(() => aiOk({ changes: 'nope' }));
    await expect(ask()).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a body that is not JSON', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<html>', { status: 200 })));
    await expect(ask()).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('says offline when the request fails', async () => {
    mockAi(() => 'network');
    await expect(ask()).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('says aborted when the caller cancelled', async () => {
    mockAi(() => 'network');
    const controller = new AbortController();
    controller.abort();
    await expect(ask(controller.signal)).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('says timeout when the time budget ran out', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort());
    mockAi(() => 'network');
    await expect(ask()).resolves.toEqual({ ok: false, reason: 'timeout' });
  });
});

describe('anySignal', () => {
  it('aborts when any input aborts', () => {
    const a = new AbortController();
    const b = new AbortController();
    const both = anySignal([a.signal, b.signal]);
    expect(both.signal.aborted).toBe(false);
    b.abort();
    expect(both.signal.aborted).toBe(true);
  });

  it('is aborted at once when an input already is', () => {
    expect(anySignal([AbortSignal.abort()]).signal.aborted).toBe(true);
  });

  it('detaches from its inputs on release, so long-lived signals keep no listeners', () => {
    const page = new AbortController();
    const removed = vi.spyOn(page.signal, 'removeEventListener');
    const linked = anySignal([page.signal]);
    linked.release();
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    page.abort();
    expect(linked.signal.aborted).toBe(false);
  });
});
