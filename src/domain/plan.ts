/**
 * The living plan: one pure function turns the user's inputs (profile, fixed
 * lines, task states, vendor statuses, quotes, payments, settings) into budget,
 * scenarios, schedule, vendor cards, quote analyses and payment totals. Nothing is
 * stored that can be derived.
 */
import type {
  CategoryId,
  EventProfile,
  PlanInput,
  PlanVersion,
  Change,
  Override,
} from '../../shared/schemas.js';
import { LIMITS } from '../../shared/limits.js';
import { buildBudget, type BudgetParams, type BudgetPlan, type FixedLine } from './budget.js';
import type { IsoDate } from './dates.js';
import { summarisePayments, type PaymentSummary } from './payments.js';
import { analyseQuote, type QuoteAnalysis } from './quotes.js';
import { buildScenarios, type Scenario } from './scenarios.js';
import { templateFor, type EventTemplate } from './templates/index.js';
import { compressionTips, schedule, type CompressionTip, type Schedule } from './timeline.js';
import { buildVendorCards, type VendorCard } from './vendors.js';

export interface Plan {
  readonly input: PlanInput;
  readonly template: EventTemplate;
  readonly budgetParams: BudgetParams;
  readonly budget: BudgetPlan;
  readonly scenarios: readonly Scenario[];
  readonly schedule: Schedule;
  readonly tips: readonly CompressionTip[];
  readonly vendors: readonly VendorCard[];
  readonly quotes: readonly QuoteAnalysis[];
  readonly payments: PaymentSummary;
}

/** A fresh plan input for a completed profile. O(1). */
export function initialInput(profile: EventProfile): PlanInput {
  return {
    profile,
    overrides: {},
    tasks: {},
    vendors: {},
    quotes: [],
    payments: [],
    settings: { strategy: 'balanced', formats: [], useContingency: false },
  };
}

function fixedLines(
  input: PlanInput,
  analyses: readonly QuoteAnalysis[],
): Partial<Record<CategoryId, FixedLine>> {
  const fixed: Partial<Record<CategoryId, FixedLine>> = {};
  for (const [category, override] of Object.entries(input.overrides) as [CategoryId, Override][]) {
    if (override.kind !== 'quote') {
      fixed[category] = { amount: override.amountPaise, provenance: override.kind, quoteId: null };
      continue;
    }
    const analysis = analyses.find((entry) => entry.quote.id === override.quoteId);
    if (analysis !== undefined) {
      const provenance = override.booked ? 'booked' : 'quote';
      fixed[category] = { amount: analysis.high, provenance, quoteId: override.quoteId };
    }
  }
  return fixed;
}

function quoteCounts(quotes: readonly QuoteAnalysis[]): Map<CategoryId, number> {
  const counts = new Map<CategoryId, number>();
  for (const entry of quotes)
    counts.set(entry.quote.category, (counts.get(entry.quote.category) ?? 0) + 1);
  return counts;
}

/**
 * Derives the whole plan from its inputs. Deterministic: same inputs and `today`
 * give the same plan, so versions only store inputs. O(c log c + t² + q·n + p log p).
 */
export function buildPlan(input: PlanInput, today: IsoDate): Plan {
  const template = templateFor(input.profile.eventType);
  const quotes = input.quotes.map((quote) => analyseQuote(quote, input.profile.guests));
  const budgetParams: BudgetParams = {
    total: input.profile.budgetPaise,
    guests: input.profile.guests,
    template,
    priorities: input.profile.priorities,
    settings: input.settings,
    fixed: fixedLines(input, quotes),
  };
  const budget = buildBudget(budgetParams);
  const timeline = schedule({
    tasks: template.tasks,
    states: input.tasks,
    eventDate: input.profile.eventDate,
    today,
  });
  const vendors = buildVendorCards({
    profile: input.profile,
    categories: budget.lines.map((line) => ({ category: line.category, planned: line.planned })),
    statuses: input.vendors,
    quoteCounts: quoteCounts(quotes),
  });
  return {
    input,
    template,
    budgetParams,
    budget,
    scenarios: buildScenarios(budgetParams, budget),
    schedule: timeline,
    tips: compressionTips(timeline),
    vendors,
    quotes,
    payments: summarisePayments(input.payments, budget.lines, today),
  };
}

/** Version 1 of a new plan. O(1). */
export function firstVersion(profile: EventProfile, today: IsoDate): PlanVersion {
  return { version: 1, createdOn: today, label: 'First plan', input: initialInput(profile) };
}

/** Parameters for {@link addVersion}. */
export interface NewVersion {
  readonly input: PlanInput;
  readonly label: string;
  readonly today: IsoDate;
  readonly changes?: readonly Change[];
}

/** Appends a version (numbered after the newest) and keeps at most the last 30. O(v). */
export function addVersion(history: readonly PlanVersion[], next: NewVersion): PlanVersion[] {
  const version = Math.max(0, ...history.map((entry) => entry.version)) + 1;
  const entry: PlanVersion = {
    version,
    createdOn: next.today,
    label: next.label.slice(0, LIMITS.maxShortText),
    input: next.input,
    ...(next.changes === undefined ? {} : { changes: [...next.changes] }),
  };
  return [...history, entry].slice(-LIMITS.maxVersions);
}
