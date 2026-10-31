import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDate,
  fromDayNumber,
  isIsoDate,
  isoFromLocal,
  parseDateText,
  toDayNumber,
} from './dates.js';

const TODAY = '2026-10-31';

describe('Timeline: calendar arithmetic', () => {
  it('adds days across months and years', () => {
    expect(addDays(TODAY, 1)).toBe('2026-11-01');
    expect(addDays(TODAY, 110)).toBe('2027-02-18');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(daysBetween(TODAY, '2027-02-18')).toBe(110);
  });

  it('round-trips day numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60_000 }),
        (day) => toDayNumber(fromDayNumber(day)) === day,
      ),
    );
  });

  it('accepts only real ISO dates', () => {
    expect(isIsoDate('2027-02-18')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false);
    expect(isIsoDate('18-02-2027')).toBe(false);
  });

  it('formats for India and reads local dates', () => {
    expect(formatDate('2027-02-18')).toBe('18 Feb 2027');
    expect(isoFromLocal(new Date(2027, 1, 8))).toBe('2027-02-08');
  });
});

describe('Intake: dates in free text', () => {
  it.each([
    ['on 2027-02-18', '2027-02-18'],
    ['wedding on 18 Feb 2027', '2027-02-18'],
    ['18th February', '2027-02-18'],
    ['Feb 18, 2027', '2027-02-18'],
    ['party on 5 Nov', '2026-11-05'],
    ['18/02/2027', '2027-02-18'],
  ])('reads "%s"', (text, expected) => {
    expect(parseDateText(text, TODAY)).toBe(expected);
  });

  it('returns null when there is no valid date', () => {
    expect(parseDateText('sometime next year', TODAY)).toBeNull();
    expect(parseDateText('31/02/2027', TODAY)).toBeNull();
    expect(parseDateText('30 Feb', TODAY)).toBeNull();
  });
});
