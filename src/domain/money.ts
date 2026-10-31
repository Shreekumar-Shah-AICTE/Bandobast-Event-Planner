/**
 * Money is always an integer number of paise. Parsing understands Indian
 * notation (1,20,000 · 1.2 lakh · 85k · ₹2 crore); formatting uses en-IN.
 */
import {
  PAISE_PER_RUPEE,
  RUPEES_PER_CRORE,
  RUPEES_PER_LAKH,
  RUPEES_PER_THOUSAND,
} from './constants.js';

/** An integer amount of paise. */
export type Paise = number;

const UNIT_RUPEES: Readonly<Record<string, number>> = {
  k: RUPEES_PER_THOUSAND,
  thousand: RUPEES_PER_THOUSAND,
  l: RUPEES_PER_LAKH,
  lac: RUPEES_PER_LAKH,
  lacs: RUPEES_PER_LAKH,
  lakh: RUPEES_PER_LAKH,
  lakhs: RUPEES_PER_LAKH,
  cr: RUPEES_PER_CRORE,
  crore: RUPEES_PER_CRORE,
  crores: RUPEES_PER_CRORE,
};

/** Number with optional currency marker and Indian unit suffix. Groups: 1 marker, 2 number, 3 unit. */
const AMOUNT_RE =
  /(₹|\brs\.?|\binr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr)?\b/giu;

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const oneDecimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/** Converts rupees (possibly fractional) to integer paise. O(1). */
export const rupees = (amount: number): Paise => Math.round(amount * PAISE_PER_RUPEE);

/** Converts paise to rupees. O(1). */
export const toRupees = (amount: Paise): number => amount / PAISE_PER_RUPEE;

/** Rounds an amount to whole rupees. O(1). */
export const roundToRupee = (amount: Paise): Paise =>
  Math.round(amount / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;

/** Adds `pct` percent (may be negative) and rounds to whole rupees. O(1). @example applyPercent(rupees(1000), -10) === rupees(900) */
export const applyPercent = (amount: Paise, pct: number): Paise =>
  roundToRupee(amount + (amount * pct) / 100);

/** Sums amounts. O(n). */
export const sumPaise = (amounts: readonly Paise[]): Paise => amounts.reduce((a, b) => a + b, 0);

/** "₹1,23,400" (whole rupees, en-IN grouping). O(1). */
export const formatInr = (amount: Paise): string => wholeRupees.format(toRupees(amount));

/** "₹12.3 lakh" / "₹1.2 crore" for large amounts, otherwise {@link formatInr}. O(1). */
export function formatCompact(amount: Paise): string {
  const value = Math.abs(toRupees(amount));
  const sign = amount < 0 ? '−' : '';
  if (value >= RUPEES_PER_CRORE)
    return `${sign}₹${oneDecimal.format(value / RUPEES_PER_CRORE)} crore`;
  if (value >= RUPEES_PER_LAKH) return `${sign}₹${oneDecimal.format(value / RUPEES_PER_LAKH)} lakh`;
  return `${sign}${formatInr(Math.abs(amount))}`;
}

/** "+₹12,000", "−₹12,000" or "no change". O(1). */
export function formatDelta(amount: Paise): string {
  if (amount === 0) return 'no change';
  return `${amount > 0 ? '+' : '−'}${formatInr(Math.abs(amount))}`;
}

interface AmountMatch {
  readonly paise: Paise;
  readonly marked: boolean;
  readonly text: string;
}

function toMatch(groups: RegExpExecArray): AmountMatch | null {
  const [text, marker, digits, unit] = groups;
  if (digits === undefined) return null;
  const multiplier = unit === undefined ? 1 : (UNIT_RUPEES[unit.toLowerCase()] ?? 1);
  const value = Number.parseFloat(digits.replaceAll(',', '')) * multiplier;
  return {
    paise: rupees(value),
    marked: marker !== undefined || unit !== undefined,
    text: text.trim(),
  };
}

/** Every amount written in `text`, in order. O(n) in the text length. */
export function findAmounts(text: string): readonly AmountMatch[] {
  const found: AmountMatch[] = [];
  for (const groups of text.matchAll(AMOUNT_RE)) {
    const match = toMatch(groups);
    if (match !== null) found.push(match);
  }
  return found;
}

/**
 * First amount in `text` that carries a currency marker or unit ("₹5,000", "5 lakh", "85k").
 * Bare numbers are ignored so "200 guests" is never read as money. O(n).
 * @example parseMoney('budget about 12 lakh') === rupees(1_200_000)
 */
export function parseMoney(text: string): Paise | null {
  return findAmounts(text).find((m) => m.marked)?.paise ?? null;
}
