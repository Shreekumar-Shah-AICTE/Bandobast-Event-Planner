/**
 * Calendar arithmetic on ISO dates (YYYY-MM-DD) as UTC day numbers, so results
 * never depend on the device's time zone. Callers pass `today` explicitly.
 */
import { MS_PER_DAY } from './constants.js';

/** An ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_NAMES = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const DAY_MONTH_RE = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_NAMES})[a-z]*\.?,?(?:\s+(\d{4}))?\b`,
  'iu',
);
const MONTH_DAY_RE = new RegExp(
  String.raw`\b(${MONTH_NAMES})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?\b`,
  'iu',
);
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/u;
const NUMERIC_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/u;
const pad = (n: number): string => String(n).padStart(2, '0');

/** Days since 1970-01-01 (UTC). O(1). */
export const toDayNumber = (date: IsoDate): number => Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;

/** Inverse of {@link toDayNumber}. O(1). */
export const fromDayNumber = (day: number): IsoDate =>
  new Date(day * MS_PER_DAY).toISOString().split('T')[0] ?? '';

/** `date` moved by `days` (negative = earlier). O(1). */
export const addDays = (date: IsoDate, days: number): IsoDate =>
  fromDayNumber(toDayNumber(date) + days);

/** Whole days from `from` to `to` (negative when `to` is earlier). O(1). */
export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  toDayNumber(to) - toDayNumber(from);

/** True for a real calendar date in ISO form (rejects 2026-02-30). O(1). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const day = toDayNumber(value);
  return Number.isFinite(day) && fromDayNumber(day) === value;
}

/** Local `Date` → ISO date in the user's own calendar (UI boundary only). O(1). */
export const isoFromLocal = (date: Date): IsoDate =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const readable = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "14 Feb 2027". O(1). */
export const formatDate = (date: IsoDate): string => readable.format(new Date(`${date}T00:00:00Z`));

function build(year: number, month: number, day: number): IsoDate | null {
  const iso = `${String(year)}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso) ? iso : null;
}

/** Without a year, picks the next occurrence on or after `today`. */
function withYear(
  month: number,
  day: number,
  year: string | undefined,
  today: IsoDate,
): IsoDate | null {
  if (year !== undefined) return build(Number(year), month, day);
  const thisYear = Number(today.slice(0, 'YYYY'.length));
  const candidate = build(thisYear, month, day);
  if (candidate === null || candidate >= today) return candidate;
  return build(thisYear + 1, month, day);
}

function monthOf(name: string | undefined): number {
  return MONTHS[(name ?? '').slice(0, 'mmm'.length).toLowerCase()] ?? 0;
}

/**
 * Finds a date in free text: "2027-02-14", "14 Feb 2027", "Feb 14", "14/02/2027" (day first,
 * as written in India). Returns null when nothing valid is found. O(n) in the text length.
 */
export function parseDateText(text: string, today: IsoDate): IsoDate | null {
  const iso = ISO_RE.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayMonth = DAY_MONTH_RE.exec(text);
  if (dayMonth) return withYear(monthOf(dayMonth[2]), Number(dayMonth[1]), dayMonth[3], today);
  const monthDay = MONTH_DAY_RE.exec(text);
  if (monthDay) return withYear(monthOf(monthDay[1]), Number(monthDay[2]), monthDay[3], today);
  const numeric = NUMERIC_RE.exec(text);
  if (numeric) return build(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  return null;
}
