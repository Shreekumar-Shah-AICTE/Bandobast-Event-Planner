/**
 * Vendor quotes: normalise to the user's guest count, bound GST, flag hidden
 * charges, list what to clarify, and compare quotes in one category. Amounts not
 * written in the pasted text are "unverified" and excluded from every total.
 */
import type { CategoryId, Quote, QuoteItem } from '../../shared/schemas.js';
import { GST_HIGH_PCT, GST_LOW_PCT } from './constants.js';
import { amountAppears } from './grounding.js';
import { applyPercent, rupees, sumPaise, type Paise } from './money.js';

export interface AnalysedItem {
  readonly item: QuoteItem;
  readonly verified: boolean;
  readonly quantity: number;
  readonly total: Paise;
}

export interface QuoteAnalysis {
  readonly quote: Quote;
  readonly items: readonly AnalysedItem[];
  /** Plates charged: the larger of your guests and the minimum guarantee. */
  readonly chargedGuests: number;
  /** Verified items only, before GST. */
  readonly subtotal: Paise;
  /** Total range including GST (low = best case, high = worst case). */
  readonly low: Paise;
  readonly high: Paise;
  readonly unverified: readonly string[];
  readonly hiddenCharges: readonly string[];
  readonly clarifications: readonly string[];
}

const HIDDEN_RE =
  /\b(extra|additional|not included|excluding|exclusive|overtime|per hour|corkage|service charge|transport|generator|diesel|plus taxes|taxes extra|advance|non[- ]refundable|cancellation|starting|onwards|approx)/iu;
const VAGUE_RE = /\b(starting|onwards|approx|approximately|subject to)\b/iu;
const MAX_FLAGS = 6;
const MAX_SNIPPET = 120;

/** Source lines that mention possible extra charges or soft prices. O(n). */
export function hiddenCharges(sourceText: string): readonly string[] {
  const lines = sourceText
    .split(/\r?\n|(?<=\.)\s+/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && HIDDEN_RE.test(line))
    .map((line) => (line.length > MAX_SNIPPET ? `${line.slice(0, MAX_SNIPPET)}…` : line));
  return [...new Set(lines)].slice(0, MAX_FLAGS);
}

function quantityFor(item: QuoteItem, chargedGuests: number): number {
  return item.unit === 'perGuest' ? chargedGuests : (item.quantity ?? 1);
}

function gstRange(subtotal: Paise, quote: Quote): readonly [Paise, Paise] {
  if (quote.gst === 'included') return [subtotal, subtotal];
  if (quote.gst === 'extra' && quote.gstRatePct !== undefined) {
    const withRate = applyPercent(subtotal, quote.gstRatePct);
    return [withRate, withRate];
  }
  const low = quote.gst === 'extra' ? applyPercent(subtotal, GST_LOW_PCT) : subtotal;
  return [low, applyPercent(subtotal, GST_HIGH_PCT)];
}

function clarificationsFor(quote: Quote, unverified: readonly string[]): string[] {
  const perGuest = quote.items.some((item) => item.unit === 'perGuest');
  return [
    ...(quote.items.length === 0 ? ['No priced items found — ask for an itemised quote.'] : []),
    ...(perGuest && quote.minGuarantee === undefined
      ? ['Ask for the minimum guarantee (the fewest plates they will charge for).']
      : []),
    ...(quote.gst === 'unknown' ? ['Ask whether GST is included.'] : []),
    ...(quote.gst === 'extra' && quote.gstRatePct === undefined
      ? [`Ask which GST rate applies (${String(GST_LOW_PCT)}% or ${String(GST_HIGH_PCT)}%).`]
      : []),
    ...unverified.map(
      (label) => `Confirm "${label}": that amount is not written in the quote text.`,
    ),
    ...(VAGUE_RE.test(quote.sourceText)
      ? ['Prices are marked approximate — ask for a fixed price.']
      : []),
  ];
}

/**
 * Normalises a quote for `guests`: per-guest lines × max(guests, minimum guarantee),
 * other lines × quantity, unverified lines excluded, GST as a range. O(i + n).
 */
export function analyseQuote(quote: Quote, guests: number): QuoteAnalysis {
  const chargedGuests = Math.max(guests, quote.minGuarantee ?? 0);
  const items = quote.items.map((item) => {
    const quantity = quantityFor(item, chargedGuests);
    const verified = amountAppears(item.amountRupees, quote.sourceText);
    return { item, verified, quantity, total: rupees(item.amountRupees * quantity) };
  });
  const subtotal = sumPaise(items.filter((entry) => entry.verified).map((entry) => entry.total));
  const unverified = items.filter((entry) => !entry.verified).map((entry) => entry.item.label);
  const [low, high] = gstRange(subtotal, quote);
  return {
    quote,
    items,
    chargedGuests,
    subtotal,
    low,
    high,
    unverified,
    hiddenCharges: hiddenCharges(quote.sourceText),
    clarifications: clarificationsFor(quote, unverified),
  };
}

export interface QuoteComparison {
  readonly category: CategoryId;
  readonly rows: readonly QuoteAnalysis[];
  /** Lowest worst-case total among fully verified quotes; ties go to fewer flags. */
  readonly bestId: string | null;
}

/** Compares the quotes of one category, cheapest worst case first. O(q log q). */
export function compareQuotes(
  analyses: readonly QuoteAnalysis[],
  category: CategoryId,
): QuoteComparison {
  const rows = analyses
    .filter((analysis) => analysis.quote.category === category)
    .sort((a, b) => a.high - b.high || a.hiddenCharges.length - b.hiddenCharges.length);
  const best = rows.find((row) => row.unverified.length === 0 && row.items.length > 0);
  return { category, rows, bestId: best?.quote.id ?? null };
}
