/**
 * Budget engine: typical cost per category for the guest count, then a split of
 * the user's total that always sums exactly to it. Fixed lines (your number,
 * quote, booked) never move; contingency absorbs rounding.
 */
import type { CategoryId, Settings } from '../../shared/schemas.js';
import {
  ALLOCATION_STEP_PAISE,
  COMFORTABLE_SURPLUS_RATIO,
  PRIORITY_TILT,
  TIGHT_SHORTFALL_RATIO,
} from './constants.js';
import { rupees, sumPaise, type Paise } from './money.js';
import type { CostModel, EventTemplate } from './templates/index.js';

export type Provenance = 'estimate' | 'user' | 'quote' | 'booked';
export type Feasibility = 'comfortable' | 'fits' | 'tight' | 'over';

/** A line whose amount the user fixed: their own number, a chosen quote or a booking. */
export interface FixedLine {
  readonly amount: Paise;
  readonly provenance: Exclude<Provenance, 'estimate'>;
  readonly quoteId: string | null;
}

export interface BudgetLine {
  readonly category: CategoryId;
  /** Typical cost for this guest count and format (assumption). */
  readonly typical: Paise;
  /** Amount in the plan. */
  readonly planned: Paise;
  readonly provenance: Provenance;
  readonly quoteId: string | null;
}

export interface BudgetPlan {
  readonly total: Paise;
  readonly lines: readonly BudgetLine[];
  /** What is left for surprises after every line. */
  readonly contingency: Paise;
  /** The reserve the template recommends. */
  readonly contingencyTarget: Paise;
  /** Typical open lines + fixed lines + recommended reserve. */
  readonly need: Paise;
  /** `need - total`; positive means a shortfall. */
  readonly gap: Paise;
  readonly feasibility: Feasibility;
}

export interface BudgetParams {
  readonly total: Paise;
  readonly guests: number;
  readonly template: EventTemplate;
  readonly priorities: readonly CategoryId[];
  readonly settings: Settings;
  readonly fixed: Readonly<Partial<Record<CategoryId, FixedLine>>>;
}

interface OpenLine {
  readonly category: CategoryId;
  readonly typical: Paise;
}

const toSteps = (amount: Paise): number => Math.round(amount / ALLOCATION_STEP_PAISE);

/** Typical cost `fixed + perGuest × guests`, scaled by a format multiplier. O(1). */
export function typicalCost(cost: CostModel, guests: number, multiplier = 1): Paise {
  return rupees(Math.round((cost.fixed + cost.perGuest * guests) * multiplier));
}

/** Combined effect of the chosen format options on one category. O(f). */
export function formatMultiplier(
  template: EventTemplate,
  formats: readonly string[],
  category: CategoryId,
): number {
  return template.formats
    .filter((option) => formats.includes(option.id))
    .reduce((product, option) => product * (option.effects[category] ?? 1), 1);
}

/**
 * Splits `units` into integers proportional to `weights` that sum exactly to `units`
 * (largest-remainder method; ties go to the earlier index). Zero weights split evenly. O(n log n).
 * @example largestRemainder(10, [1, 1, 1]) → [4, 3, 3]
 */
export function largestRemainder(units: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) =>
    totalWeight > 0 ? (units * w) / totalWeight : units / weights.length,
  );
  const floors = shares.map((share) => Math.floor(share));
  const remaining = units - floors.reduce((a, b) => a + b, 0);
  const bumped = new Set(
    shares
      .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .slice(0, remaining)
      .map((entry) => entry.index),
  );
  return floors.map((floor, index) => floor + (bumped.has(index) ? 1 : 0));
}

/** Weight boost for the user's 1st/2nd/3rd priority. O(p). */
export function tiltFor(category: CategoryId, priorities: readonly CategoryId[]): number {
  const rank = priorities.indexOf(category);
  return rank < 0 ? 1 : (PRIORITY_TILT[rank] ?? 1);
}

/** Feasibility band from the shortfall (`gap`) relative to the typical need. O(1). */
export function feasibilityOf(gap: Paise, need: Paise): Feasibility {
  const ratio = need > 0 ? gap / need : -1;
  if (ratio <= -COMFORTABLE_SURPLUS_RATIO) return 'comfortable';
  if (ratio <= 0) return 'fits';
  return ratio <= TIGHT_SHORTFALL_RATIO ? 'tight' : 'over';
}

function toMap(lines: readonly OpenLine[], steps: readonly number[]): Map<CategoryId, Paise> {
  return new Map(lines.map((line, i) => [line.category, (steps[i] ?? 0) * ALLOCATION_STEP_PAISE]));
}

/** Priorities at their typical cost, the rest shared; null when the priorities alone do not fit. */
function protectPriorities(
  open: readonly OpenLine[],
  units: number,
  priorities: readonly CategoryId[],
): Map<CategoryId, Paise> | null {
  const kept = open.filter((line) => priorities.includes(line.category));
  const keptSteps = kept.map((line) => toSteps(line.typical));
  const keptTotal = keptSteps.reduce((a, b) => a + b, 0);
  if (keptTotal > units) return null;
  const others = open.filter((line) => !priorities.includes(line.category));
  const otherSteps = largestRemainder(
    units - keptTotal,
    others.map((line) => line.typical),
  );
  return new Map([...toMap(kept, keptSteps), ...toMap(others, otherSteps)]);
}

function allocateOpen(
  open: readonly OpenLine[],
  available: Paise,
  params: BudgetParams,
): Map<CategoryId, Paise> {
  const units = Math.floor(available / ALLOCATION_STEP_PAISE);
  const { strategy } = params.settings;
  const protectedSplit =
    strategy === 'protect' ? protectPriorities(open, units, params.priorities) : null;
  if (protectedSplit !== null) return protectedSplit;
  const weights = open.map((line) =>
    strategy === 'share' ? line.typical : line.typical * tiltFor(line.category, params.priorities),
  );
  return toMap(open, largestRemainder(units, weights));
}

function typicalLines(params: BudgetParams): OpenLine[] {
  return params.template.categories.map((entry) => ({
    category: entry.id,
    typical: typicalCost(
      entry.cost,
      params.guests,
      formatMultiplier(params.template, params.settings.formats, entry.id),
    ),
  }));
}

function lineFor(line: OpenLine, fixed: FixedLine | undefined, planned: Paise): BudgetLine {
  if (fixed === undefined) return { ...line, planned, provenance: 'estimate', quoteId: null };
  return { ...line, planned: fixed.amount, provenance: fixed.provenance, quoteId: fixed.quoteId };
}

/**
 * Builds the budget: typical costs, the recommended reserve, the split of what is
 * left, and the feasibility band. Invariant: `Σ planned + contingency === total`.
 * O(c log c) for c categories.
 */
export function buildBudget(params: BudgetParams): BudgetPlan {
  const typical = typicalLines(params);
  const fixedTotal = sumPaise(Object.values(params.fixed).map((line) => line.amount));
  const open = typical.filter((line) => params.fixed[line.category] === undefined);
  const target =
    toSteps((params.total * params.template.contingencyPct) / 100) * ALLOCATION_STEP_PAISE;
  const need = sumPaise(open.map((line) => line.typical)) + fixedTotal + target;
  const gap = need - params.total;
  const reserve = params.settings.useContingency ? Math.max(0, target - Math.max(0, gap)) : target;
  const planned = allocateOpen(open, Math.max(0, params.total - fixedTotal - reserve), params);
  const lines = typical.map((line) =>
    lineFor(line, params.fixed[line.category], planned.get(line.category) ?? 0),
  );
  const contingency = params.total - sumPaise(lines.map((line) => line.planned));
  return {
    total: params.total,
    lines,
    contingency,
    contingencyTarget: target,
    need,
    gap,
    feasibility: feasibilityOf(gap, need),
  };
}
