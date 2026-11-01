/**
 * Rule-based quote reader, used when the AI is unavailable. It reads one priced
 * line at a time; anything it cannot read stays in the text for the user to review.
 */
import type { CategoryId, QuoteDraft, QuoteItem } from '../../shared/schemas.js';
import { LIMITS } from '../../shared/limits.js';
import { findAmounts, toRupees, type AmountMatch } from './money.js';

const PER_GUEST_RE = /(per\s*(plate|head|person|guest|pax)|\/\s*(plate|head|person|pax)|\bpp\b)/iu;
const PER_HOUR_RE = /(per\s*hour|\/\s*hr|\/\s*hour|hourly)/iu;
const PER_DAY_RE = /(per\s*day|\/\s*day)/iu;
const PER_PIECE_RE = /(per\s*(piece|pc|card|kg)|\/\s*(piece|pc|card|kg))/iu;
const MIN_GUARANTEE_RE =
  /min(?:imum)?\.?\s*(?:guarantee|order|booking)?\s*(?:of\s*)?(\d{2,4})\s*(?:plates|pax|guests|people|persons)/iu;
const GST_RATE_RE = /(\d{1,2})\s*%\s*gst|gst\s*@?\s*(\d{1,2})\s*%/iu;
const GST_INCLUDED_RE = /(incl(?:uding|usive|\.)?\s*(?:of\s*)?(?:gst|taxes)|gst\s*incl)/iu;
const GST_EXTRA_RE =
  /(\+\s*gst|plus\s*gst|gst\s*(?:extra|additional|excluded)|excl(?:uding|usive)?\.?\s*(?:of\s*)?gst|taxes\s*extra)/iu;
const MAX_LABEL = 60;

function unitOf(line: string): QuoteItem['unit'] {
  if (PER_GUEST_RE.test(line)) return 'perGuest';
  if (PER_HOUR_RE.test(line)) return 'perHour';
  if (PER_DAY_RE.test(line)) return 'perDay';
  return PER_PIECE_RE.test(line) ? 'perPiece' : 'fixed';
}

function labelOf(line: string, amountText: string): string {
  const label = line
    .replace(amountText, ' ')
    .replace(/[-–:•*]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return (label.length > 0 ? label : 'Quoted amount').slice(0, MAX_LABEL);
}

const UNIT_PHRASES = [PER_GUEST_RE, PER_HOUR_RE, PER_DAY_RE, PER_PIECE_RE];
/** Smaller bare numbers next to "per plate" are counts ("2 per table"), not prices. */
const MIN_BARE_RUPEES = 10;

/**
 * For WhatsApp-style lines without ₹ or Rs ("Veg thali 850 per plate"): the bare
 * number written closest to the unit phrase. Percentages never count. O(n).
 */
function bareUnitPrice(line: string): AmountMatch | undefined {
  const phrase = UNIT_PHRASES.map((re) => re.exec(line)).find((match) => match !== null);
  if (!phrase) return undefined;
  const start = phrase.index;
  const end = start + phrase[0].length;
  const gap = (m: AmountMatch): number => {
    const after = m.index + m.text.length;
    if (after <= start) return start - after;
    return m.index >= end ? m.index - end : Number.POSITIVE_INFINITY;
  };
  const candidates = findAmounts(line).filter(
    (m) =>
      toRupees(m.paise) >= MIN_BARE_RUPEES &&
      !line
        .slice(m.index + m.text.length)
        .trimStart()
        .startsWith('%'),
  );
  return candidates.sort((a, b) => gap(a) - gap(b))[0];
}

function itemFrom(line: string): QuoteItem | null {
  if (GST_RATE_RE.test(line) && findAmounts(line).every((m) => !m.marked)) return null;
  const amount = findAmounts(line).find((m) => m.marked) ?? bareUnitPrice(line);
  if (amount === undefined || amount.paise <= 0) return null;
  return {
    label: labelOf(line, amount.text),
    unit: unitOf(line),
    amountRupees: toRupees(amount.paise),
  };
}

function gstOf(text: string): Pick<QuoteDraft, 'gst' | 'gstRatePct'> {
  const rate = GST_RATE_RE.exec(text);
  const pct = rate ? Number(rate[1] ?? rate[2]) : undefined;
  if (GST_INCLUDED_RE.test(text)) return { gst: 'included' };
  if (GST_EXTRA_RE.test(text) || pct !== undefined) {
    return pct === undefined ? { gst: 'extra' } : { gst: 'extra', gstRatePct: pct };
  }
  return { gst: 'unknown' };
}

/** Terms lines, not names: minimums, percentages and tax notes. */
function isTermsLine(line: string): boolean {
  return MIN_GUARANTEE_RE.test(line) || /%|\bgst\b|\btax/iu.test(line);
}

function vendorOf(lines: readonly string[]): string {
  const first = lines.find(
    (line) =>
      line.length > 0 &&
      itemFrom(line) === null &&
      findAmounts(line).every((m) => !m.marked) &&
      !isTermsLine(line),
  );
  return (first ?? 'Vendor quote').slice(0, MAX_LABEL);
}

/** Reads a pasted quote into a draft the user reviews before saving. O(n). */
export function parseQuoteText(text: string, category: CategoryId): QuoteDraft {
  const lines = text.split(/\r?\n/u).map((line) => line.trim());
  const items = lines
    .map(itemFrom)
    .filter((item): item is QuoteItem => item !== null)
    .slice(0, LIMITS.maxQuoteItems);
  const minimum = MIN_GUARANTEE_RE.exec(text);
  const draft: QuoteDraft = {
    vendorName: vendorOf(lines),
    category,
    items,
    ...gstOf(text),
    notes: [],
  };
  return minimum ? { ...draft, minGuarantee: Number(minimum[1]) } : draft;
}
