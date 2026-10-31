import { describe, expect, it } from 'vitest';
import { within } from './time.js';

describe('within', () => {
  it('returns the result of work that finishes in time', async () => {
    expect(await within(Promise.resolve('hit'), 50, 'miss')).toBe('hit');
  });

  it('returns the fallback when work fails or is too slow', async () => {
    expect(await within(Promise.reject(new Error('down')), 50, 'miss')).toBe('miss');
    expect(await within(new Promise<string>(() => undefined), 10, 'miss')).toBe('miss');
  });
});
