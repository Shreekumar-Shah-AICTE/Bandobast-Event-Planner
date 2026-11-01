import { describe, expect, it } from 'vitest';
import { weddingProfile } from '../test/fixtures.js';
import { buildBudget, type BudgetParams } from './budget.js';
import { rupees, sumPaise } from './money.js';
import {
  buildScenarios,
  formatSaving,
  painLevel,
  painOf,
  painWeight,
  pickFormats,
} from './scenarios.js';
import { templateFor } from './templates/index.js';

const WEDDING = templateFor('wedding');

function params(guests: number, totalRupees: number): BudgetParams {
  const profile = weddingProfile();
  return {
    total: rupees(totalRupees),
    guests,
    cityFactor: 1,
    template: WEDDING,
    priorities: profile.priorities,
    settings: { strategy: 'balanced', formats: [], useContingency: false },
    fixed: {},
  };
}

describe('Budget: rebalance scenarios after "50 more guests, budget down 10%, event 2 weeks earlier"', () => {
  const after = params(250, 1_080_000);
  const current = buildBudget(after);
  const scenarios = buildScenarios(after, current);

  it('reports the shortfall and offers at most three options, least painful first', () => {
    expect(current.feasibility).toBe('over');
    expect(current.gap).toBe(rupees(153_900));
    expect(scenarios.map((s) => s.id)).toEqual(['protect', 'share', 'format']);
    const pains = scenarios.map((s) => s.pain);
    expect([...pains].sort((a, b) => a - b)).toEqual(pains);
    expect(scenarios.map((s) => s.painLevel)).toEqual(['medium', 'medium', 'high']);
  });

  it('runs every option through the same engine, so each one still adds up', () => {
    for (const scenario of scenarios) {
      const { budget } = scenario;
      expect(sumPaise(budget.lines.map((l) => l.planned)) + budget.contingency).toBe(after.total);
      expect(scenario.label.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });

  it('"Protect your priorities" keeps food and photography at the typical cost', () => {
    const protect = scenarios.find((s) => s.id === 'protect')!;
    expect(protect.description).toContain('Food & catering');
    for (const id of ['catering', 'photography'] as const) {
      const line = protect.budget.lines.find((l) => l.category === id)!;
      expect(line.planned).toBeGreaterThanOrEqual(line.typical - rupees(100));
    }
  });

  it('"Change the format" picks format options that cover the shortfall', () => {
    const format = scenarios.find((s) => s.id === 'format')!;
    expect(format.formats.map((f) => f.id)).toContain('lunch-reception');
    const saving = sumPaise(format.formats.map((f) => formatSaving(f, current)));
    expect(saving).toBeGreaterThanOrEqual(current.gap);
    expect(format.settings.formats).toEqual(format.formats.map((f) => f.id));
  });

  it('offers no contingency option when the shortfall is bigger than the reserve', () => {
    expect(current.gap).toBeGreaterThan(current.contingencyTarget);
    expect(scenarios.some((s) => s.id === 'contingency')).toBe(false);
  });
});

describe('Budget: scenario ranking rules', () => {
  it('returns nothing when the budget covers typical costs', () => {
    const fits = params(200, 1_200_000);
    expect(buildScenarios(fits, buildBudget(fits))).toEqual([]);
  });

  it('offers "Use the contingency" when the reserve covers a small shortfall', () => {
    const small = params(200, 1_100_000);
    const budget = buildBudget(small);
    expect(budget.feasibility).toBe('tight');
    expect(budget.gap).toBe(rupees(40_000));
    expect(budget.contingencyTarget).toBe(rupees(88_000));
    const scenarios = buildScenarios(small, budget);
    expect(scenarios.map((s) => s.id)).toEqual(['protect', 'contingency', 'share']);
    const reserve = scenarios.find((s) => s.id === 'contingency')!;
    expect(reserve.painLevel).toBe('low');
    expect(reserve.budget.contingency).toBe(rupees(48_000));
    expect(reserve.description).toContain('₹48,000 for surprises');
    for (const line of reserve.budget.lines) {
      expect(line.planned).toBeGreaterThanOrEqual(line.typical - rupees(100));
    }
  });

  it('skips options that equal the current settings and formats already chosen', () => {
    const shared: BudgetParams = {
      ...params(250, 1_080_000),
      settings: { strategy: 'share', formats: ['lunch-reception'], useContingency: false },
    };
    const budget = buildBudget(shared);
    const ids = buildScenarios(shared, budget).map((s) => s.id);
    expect(ids).not.toContain('share');
    expect(pickFormats(shared, budget).map((f) => f.id)).not.toContain('lunch-reception');
  });

  it('weights pain by priority rank and bands it', () => {
    expect(painWeight('catering', ['catering', 'photography'])).toBe(3);
    expect(painWeight('photography', ['catering', 'photography'])).toBe(2);
    expect(painWeight('decor', ['catering', 'photography'])).toBe(1);
    expect(painLevel(0.5)).toBe('low');
    expect(painLevel(1.5)).toBe('medium');
    expect(painLevel(2)).toBe('high');
    const fits = buildBudget(params(200, 1_200_000));
    expect(painOf(fits, ['catering'], 0)).toBe(0);
    expect(painOf(fits, ['catering'], 1.5)).toBe(1.5);
  });
});

describe('Budget: scenarios without priorities or format options', () => {
  it('drops "protect" without priorities and "format" when every format is chosen', () => {
    const plain: BudgetParams = { ...params(250, 1_080_000), priorities: [] };
    expect(buildScenarios(plain, buildBudget(plain)).map((s) => s.id)).not.toContain('protect');
    const allFormats: BudgetParams = {
      ...params(250, 900_000),
      settings: {
        strategy: 'balanced',
        formats: WEDDING.formats.map((f) => f.id),
        useContingency: false,
      },
    };
    expect(buildScenarios(allFormats, buildBudget(allFormats)).map((s) => s.id)).not.toContain(
      'format',
    );
  });

  it('treats a fourth priority like any other line, and no reserve as no reserve pain', () => {
    const four = ['catering', 'photography', 'decor', 'venue'] as const;
    expect(painWeight('venue', four)).toBe(1);
    const fits = buildBudget(params(200, 1_200_000));
    expect(painOf({ ...fits, contingencyTarget: 0, contingency: 0 }, [], 0)).toBe(0);
  });
});
