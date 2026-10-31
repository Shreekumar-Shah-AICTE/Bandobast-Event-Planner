/**
 * Grounding checks for AI output: an amount the model extracted from pasted text
 * counts only if the same amount is written in that text.
 */
import { findAmounts, rupees } from './money.js';

/** True when `amountRupees` is written in `text` in any Indian notation. O(n). */
export function amountAppears(amountRupees: number, text: string): boolean {
  const wanted = rupees(amountRupees);
  return findAmounts(text).some((match) => match.paise === wanted);
}

const squash = (value: string): string => value.toLowerCase().replace(/\s+/gu, ' ').trim();

/** True when `quote` occurs in `source`, ignoring case and runs of whitespace. O(n). */
export function quotedFrom(quote: string, source: string): boolean {
  const needle = squash(quote);
  return needle.length > 0 && squash(source).includes(needle);
}

const PHONE_RE = /(?:\+?91[\s-]?)?(?:\d[\s-]?){9}\d\b/gu;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;

/** Replaces phone numbers and e-mail addresses before text leaves the device. O(n). */
export function redactContacts(text: string): string {
  return text.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

const PRICE_RE =
  /(₹|\brs\.?\s*\d|\binr\b|\d\s*(k|lakh|lakhs|lac|crore|cr)\b|\d[\d,]*\s*\/-|per plate)/iu;
const CONTACT_RE = /(https?:\/\/|www\.|@[\w-]+\.|\+91|\b\d{10}\b)/iu;
const BUSINESS_RE =
  /\b[A-Z][\w&'-]*\s+(Caterers?|Decorators?|Studios?|Events|Banquets?|Photography|Pvt|Ltd|Enterprises)\b/u;

/** True when idea or brief text names a price, a contact or a business (not allowed). O(n). */
export function mentionsPriceOrVendor(text: string): boolean {
  return PRICE_RE.test(text) || CONTACT_RE.test(text) || BUSINESS_RE.test(text);
}
