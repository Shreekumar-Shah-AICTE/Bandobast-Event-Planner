/**
 * Rebalance scenarios for a shortfall. Each scenario is a different set of plan
 * settings run through the same budget engine, then ranked by how much it hurts
 * the user's own priorities ("pain"). Lower pain ranks first.
 */
import type { CategoryId, Settings } from '../../shared/schemas.js';
import { buildBudget, type BudgetParams, type BudgetPlan } from './budget.js';
import { CATEGORIES } from './catalog.js';
import { CONTINGENCY_PAIN, DEFAULT_PAIN, PRIORITY_PAIN } from './constants.js';
import { formatCompact, sumPaise, type Paise } from './money.js';
import type { FormatOption } from './templates/index.js';

/**
 * The four ways to rebalance: protect the priorities, share the cut, change the format, or use the
 * reserve.
 */
export type ScenarioId = 'protect' | 'share' | 'format' | 'contingency';
/** How much a rebalance option asks of the hosts. */
export type PainLevel = 'low' | 'medium' | 'high';

/** One ranked way to rebalance: its settings, the budget they produce and how much it hurts. */
export interface Scenario {
  readonly id: ScenarioId;
  readonly label: string;
  readonly description: string;
  readonly settings: Settings;
  readonly budget: BudgetPlan;
  readonly pain: number;
  readonly painLevel: PainLevel;
  /** Format options this scenario adds. */
  readonly formats: readonly FormatOption[];
}

interface Candidate {
  readonly id: ScenarioId;
  readonly settings: Settings;
  readonly formats: readonly FormatOption[];
}

const MAX_SCENARIOS = 3;
/** Pain below this is "low", below the next is "medium" (one full cut of an ordinary line = 1). */
const PAIN_LOW = 0.75;
const PAIN_MEDIUM = 2;

const LABELS: Readonly<Record<ScenarioId, string>> = {
  protect: 'Protect your priorities',
  share: 'Share the cut evenly',
  format: 'Change the format',
  contingency: 'Use the contingency',
};

/** How much a cut in this category hurts, from the user's priority order. O(p). */
export function painWeight(category: CategoryId, priorities: readonly CategoryId[]): number {
  const rank = priorities.indexOf(category);
  return rank < 0 ? DEFAULT_PAIN : (PRIORITY_PAIN[rank] ?? DEFAULT_PAIN);
}

/**
 * Priority-weighted pain: Σ weight × (share cut below typical) over estimated lines,
 * plus format compromises, plus the share of the reserve used. O(c).
 */
export function painOf(
  budget: BudgetPlan,
  priorities: readonly CategoryId[],
  compromise: number,
): number {
  const linePain = budget.lines
    .filter((line) => line.provenance === 'estimate' && line.typical > 0)
    .reduce(
      (sum, line) =>
        sum +
        (painWeight(line.category, priorities) * Math.max(0, line.typical - line.planned)) /
          line.typical,
      0,
    );
  const reserveUsed =
    budget.contingencyTarget > 0
      ? Math.max(0, budget.contingencyTarget - budget.contingency) / budget.contingencyTarget
      : 0;
  return linePain + compromise + CONTINGENCY_PAIN * reserveUsed;
}

/** Pain band for display. O(1). */
export const painLevel = (pain: number): PainLevel => {
  if (pain < PAIN_LOW) return 'low';
  return pain < PAIN_MEDIUM ? 'medium' : 'high';
};

/** Saving of one format option at typical prices on open (estimated) lines. O(c). */
export function formatSaving(option: FormatOption, budget: BudgetPlan): Paise {
  return sumPaise(
    budget.lines
      .filter((line) => line.provenance === 'estimate')
      .map((line) => Math.round(line.typical * (1 - (option.effects[line.category] ?? 1)))),
  );
}

/** Cheapest-compromise-first format options until the shortfall is covered. O(f log f + f·c). */
export function pickFormats(params: BudgetParams, current: BudgetPlan): FormatOption[] {
  const ranked = params.template.formats
    .filter((option) => !params.settings.formats.includes(option.id))
    .map((option) => ({ option, saving: formatSaving(option, current) }))
    .filter((entry) => entry.saving > 0)
    .sort((a, b) => b.saving / b.option.compromise - a.saving / a.option.compromise);
  const chosen: FormatOption[] = [];
  let covered = 0;
  for (const entry of ranked) {
    if (covered >= current.gap) break;
    chosen.push(entry.option);
    covered += entry.saving;
  }
  return chosen;
}

function describe(
  candidate: Candidate,
  budget: BudgetPlan,
  priorities: readonly CategoryId[],
): string {
  switch (candidate.id) {
    case 'protect': {
      const names = priorities.map((id) => CATEGORIES[id].label).join(', ');
      return `Keeps ${names} at the typical cost; the other lines share the cut.`;
    }
    case 'share':
      return 'Trims every open line by the same share of its typical cost.';
    case 'format':
      return `${candidate.formats.map((option) => option.label).join('; ')}.`;
    case 'contingency':
      return `Covers the shortfall from the reserve, leaving ${formatCompact(budget.contingency)} for surprises.`;
  }
}

const sameSettings = (a: Settings, b: Settings): boolean =>
  a.strategy === b.strategy &&
  a.useContingency === b.useContingency &&
  a.formats.join('|') === b.formats.join('|');

function candidates(params: BudgetParams, current: BudgetPlan): Candidate[] {
  const base = params.settings;
  const formats = pickFormats(params, current);
  const list: Candidate[] = [
    // Without priorities, "protect" would be the same as "share".
    ...(params.priorities.length > 0
      ? [{ id: 'protect', settings: { ...base, strategy: 'protect' }, formats: [] } as const]
      : []),
    { id: 'share', settings: { ...base, strategy: 'share' }, formats: [] },
  ];
  if (formats.length > 0) {
    const ids = [...base.formats, ...formats.map((option) => option.id)];
    list.push({ id: 'format', settings: { ...base, formats: ids }, formats });
  }
  if (current.gap <= current.contingencyTarget) {
    const strategy = base.strategy === 'balanced' ? 'share' : base.strategy;
    list.push({
      id: 'contingency',
      settings: { ...base, strategy, useContingency: true },
      formats: [],
    });
  }
  return list.filter((candidate) => !sameSettings(candidate.settings, base));
}

/**
 * Up to three ways to absorb a shortfall, ranked by pain (lowest first). Empty when
 * the budget already covers typical costs. O(s · c log c).
 */
export function buildScenarios(params: BudgetParams, current: BudgetPlan): readonly Scenario[] {
  if (current.gap <= 0) return [];
  return candidates(params, current)
    .map((candidate) => {
      const budget = buildBudget({ ...params, settings: candidate.settings });
      const compromise = candidate.formats.reduce((sum, option) => sum + option.compromise, 0);
      const pain = painOf(budget, params.priorities, compromise);
      return {
        id: candidate.id,
        label: LABELS[candidate.id],
        description: describe(candidate, budget, params.priorities),
        settings: candidate.settings,
        budget,
        pain,
        painLevel: painLevel(pain),
        formats: candidate.formats,
      };
    })
    .sort((a, b) => a.pain - b.pain)
    .slice(0, MAX_SCENARIOS);
}
