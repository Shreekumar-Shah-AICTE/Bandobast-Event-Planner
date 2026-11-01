import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyPercent,
  findAmounts,
  formatCompact,
  formatDelta,
  formatInr,
  parseMoney,
  roundToRupee,
  rupees,
  sumPaise,
  toRupees,
} from './money.js';

describe('Budget: money in paise', () => {
  it('converts rupees to integer paise and back', () => {
    expect(rupees(850.5)).toBe(85_050);
    expect(toRupees(85_050)).toBe(850.5);
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e8 }), (r) => toRupees(rupees(r)) === r));
  });

  it('formats with Indian digit grouping and lakh/crore words', () => {
    expect(formatInr(rupees(123_400))).toBe('₹1,23,400');
    expect(formatCompact(rupees(1_230_000))).toBe('₹12.3 lakh');
    expect(formatCompact(rupees(25_000_000))).toBe('₹2.5 crore');
    expect(formatCompact(rupees(45_000))).toBe('₹45,000');
    expect(formatCompact(-rupees(150_000))).toBe('−₹1.5 lakh');
    expect(formatDelta(rupees(12_000))).toBe('+₹12,000');
    expect(formatDelta(-rupees(12_000))).toBe('−₹12,000');
    expect(formatDelta(0)).toBe('no change');
  });

  it('reads Indian notation: commas, lakh, k, crore, Rs and ₹', () => {
    expect(parseMoney('budget about 12 lakh')).toBe(rupees(1_200_000));
    expect(parseMoney('₹1,20,000 all inclusive')).toBe(rupees(120_000));
    expect(parseMoney('Rs. 85k')).toBe(rupees(85_000));
    expect(parseMoney('1.5 crore')).toBe(rupees(15_000_000));
    expect(parseMoney('2.5L for food')).toBe(rupees(250_000));
    expect(parseMoney('INR 5000')).toBe(rupees(5000));
  });

  it('reads the rupee suffixes used in Indian quotes: "/-", "rupees" and "Rs"', () => {
    expect(parseMoney('Decoration 45,000/-')).toBe(rupees(45_000));
    expect(parseMoney('Mehendi 6000 rupees')).toBe(rupees(6000));
    expect(parseMoney('Band 15000 Rs only')).toBe(rupees(15_000));
    expect(findAmounts('Tent 3,500/- per day').map((m) => [m.text, m.index])).toEqual([
      ['3,500/-', 5],
    ]);
  });

  it('ignores bare numbers so "200 guests" is never money', () => {
    expect(parseMoney('200 guests on 12 Feb')).toBeNull();
    expect(findAmounts('200 guests, ₹850 per plate').map((m) => m.marked)).toEqual([false, true]);
  });

  it('applies percentages and rounds to whole rupees', () => {
    expect(applyPercent(rupees(1_200_000), -10)).toBe(rupees(1_080_000));
    expect(roundToRupee(12_345)).toBe(12_300);
    expect(sumPaise([1, 2, 3])).toBe(6);
  });
});
