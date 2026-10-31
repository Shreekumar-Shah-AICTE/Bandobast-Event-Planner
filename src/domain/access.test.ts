import { describe, expect, it } from 'vitest';
import { at, field, lookup } from './access.js';

describe('Engine: checked access never invents a default', () => {
  it('returns present values', () => {
    expect(at([10, 20], 1)).toBe(20);
    expect(lookup(new Map([['a', 0]]), 'a')).toBe(0);
    expect(field({ feb: 2 }, 'feb')).toBe(2);
  });

  it('throws on a missing index or key', () => {
    expect(() => at([], 0)).toThrow(RangeError);
    expect(() => lookup(new Map<string, number>(), 'x')).toThrow('No entry for "x"');
    expect(() => field({}, 'jan')).toThrow('No field "jan"');
  });
});
