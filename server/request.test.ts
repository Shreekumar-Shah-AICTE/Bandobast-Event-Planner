import { describe, expect, it } from 'vitest';
import { checkRequest, clientKey } from './request.js';

const URL_ = 'https://bandobast.test/api/ai/change';
const request = (headers: Record<string, string>) => new Request(URL_, { method: 'POST', headers });

describe('checkRequest', () => {
  it('accepts a same-origin JSON POST, whatever the content-type casing', () => {
    const ok = request({
      'content-type': 'Application/JSON; charset=utf-8',
      origin: 'https://bandobast.test',
    });
    expect(checkRequest(ok)).toBe(null);
  });

  it('refuses a POST without a content type', () => {
    expect(checkRequest(request({ origin: 'https://bandobast.test' }))?.status).toBe(415);
  });
});

describe('clientKey', () => {
  it('hashes the platform IP with a salt and never returns the address', async () => {
    const real = await clientKey(request({ 'x-real-ip': '203.0.113.7' }), 'salt');
    expect(real).toMatch(/^[0-9a-f]{32}$/u);
    expect(real).not.toContain('203');
    expect(await clientKey(request({ 'x-real-ip': '203.0.113.7' }), 'other')).not.toBe(real);
  });

  it('falls back to the first forwarded address, then to one shared key', async () => {
    const forwarded = await clientKey(
      request({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }),
      'salt',
    );
    expect(forwarded).toBe(await clientKey(request({ 'x-real-ip': '198.51.100.4' }), 'salt'));
    expect(await clientKey(request({}), 'salt')).toMatch(/^[0-9a-f]{32}$/u);
  });
});
