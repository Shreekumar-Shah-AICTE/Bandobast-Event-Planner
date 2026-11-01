/**
 * Every tunable number used by the planning engine, with where it comes from.
 * "Assumption" means a planning default the user can override, not a fact.
 */

/**
 * Unit conversions. Money is integer paise and dates are day numbers (docs/ARCHITECTURE.md,
 * ADR-004).
 */
export const PAISE_PER_RUPEE = 100;
export const RUPEES_PER_THOUSAND = 1000;
export const RUPEES_PER_LAKH = 100_000;
export const RUPEES_PER_CRORE = 10_000_000;
export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_WEEK = 7;
/** Calendar approximation for "a month earlier" in change requests. */
export const DAYS_PER_MONTH = 30;

/** Budget lines are planned in ₹100 steps so they read cleanly; contingency absorbs the remainder. */
export const ALLOCATION_STEP_PAISE = 100 * PAISE_PER_RUPEE;

/** Assumption: weight boost for the user's 1st, 2nd and 3rd priority in a balanced split. */
export const PRIORITY_TILT = [1.3, 1.2, 1.1] as const;
/** Assumption: how much a cut hurts for the 1st, 2nd and 3rd priority (others count 1). */
export const PRIORITY_PAIN = [3, 2, 1.5] as const;
/** Pain weight of a cut to a line that is not a priority. */
export const DEFAULT_PAIN = 1;
/** Assumption: emptying the whole contingency counts like a full cut of one ordinary line. */
export const CONTINGENCY_PAIN = 1;

/** Feasibility bands: a shortfall up to 10% of the typical cost is "tight", more is "over". */
export const TIGHT_SHORTFALL_RATIO = 0.1;
/** A surplus of 10% or more over the typical cost is "comfortable". */
export const COMFORTABLE_SURPLUS_RATIO = 0.1;

/** Tasks with this many days of slack or fewer are shown as "tight". */
export const TIGHT_SLACK_DAYS = 3;

/** Venue capacity rule of thumb: plan seating for 10% more than the expected guests. */
export const VENUE_HEADROOM_PCT = 110;

/** GST slabs that commonly apply to catering and event services in India (verify with the vendor). */
export const GST_LOW_PCT = 5;
export const GST_HIGH_PCT = 18;

/** Ideas carry a relative cost level, never a price. */
export const COST_LEVELS = [1, 2, 3] as const;
/** The highest idea cost level (₹₹₹). */
export const MAX_COST_LEVEL = 3;

/** Number words accepted by the rule-based change parser (English and Hindi). */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  ek: 1,
  two: 2,
  do: 2,
  three: 3,
  teen: 3,
  four: 4,
  char: 4,
  five: 5,
  paanch: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
};
