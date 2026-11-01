import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/limits.js';
import { EVENT_TYPES, STRATEGIES, type CategoryId } from '../../shared/schemas.js';
import { weddingProfile } from '../test/fixtures.js';
import {
  buildBudget,
  cappedSplit,
  feasibilityOf,
  formatMultiplier,
  largestRemainder,
  tiltFor,
  typicalCost,
  type BudgetParams,
  type FixedLine,
} from './budget.js';
import { ALLOCATION_STEP_PAISE } from './constants.js';
import { rupees, sumPaise } from './money.js';
import { templateFor } from './templates/index.js';

const WEDDING = templateFor('wedding');

function weddingParams(overrides: Partial<BudgetParams> = {}): BudgetParams {
  const profile = weddingProfile();
  return {
    total: profile.budgetPaise,
    guests: profile.guests,
    template: WEDDING,
    priorities: profile.priorities,
    settings: { strategy: 'balanced', formats: [], useContingency: false },
    fixed: {},
    ...overrides,
  };
}

const plannedSum = (params: BudgetParams): number => {
  const budget = buildBudget(params);
  return sumPaise(budget.lines.map((line) => line.planned)) + budget.contingency;
};

describe('Budget: typical costs and exact splits', () => {
  it('prices a line as fixed + per guest, scaled by the format multiplier', () => {
    expect(typicalCost({ fixed: 10_000, perGuest: 500 }, 200)).toBe(rupees(110_000));
    expect(typicalCost({ fixed: 10_000, perGuest: 500 }, 200, 0.5)).toBe(rupees(55_000));
    expect(formatMultiplier(WEDDING, ['lunch-reception'], 'catering')).toBe(0.85);
    expect(formatMultiplier(WEDDING, ['lunch-reception', 'fewer-counters'], 'catering')).toBe(
      0.85 * 0.9,
    );
    expect(formatMultiplier(WEDDING, [], 'catering')).toBe(1);
  });

  it('caps a split at each line and passes the excess on', () => {
    expect(cappedSplit(100, [3, 1], [50, 100])).toEqual([50, 50]);
    expect(cappedSplit(100, [1, 1], [20, 30])).toEqual([20, 30]);
    expect(cappedSplit(10, [1, 1], [100, 100])).toEqual([5, 5]);
  });

  it('splits units by largest remainder, ties to the earlier line', () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(7, [0, 0])).toEqual([4, 3]);
    expect(largestRemainder(5, [])).toEqual([]);
  });

  it('always sums exactly and stays within one unit of the exact share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 13 }),
        (units, weights) => {
          const split = largestRemainder(units, weights);
          const total = weights.reduce((a, b) => a + b, 0);
          expect(split.reduce((a, b) => a + b, 0)).toBe(units);
          split.forEach((value, i) => {
            const exact = total > 0 ? (units * weights[i]!) / total : units / weights.length;
            expect(Math.abs(value - exact)).toBeLessThan(1);
          });
        },
      ),
    );
  });

  it('tilts weight towards the first, second and third priority', () => {
    const priorities: CategoryId[] = ['catering', 'photography', 'decor'];
    expect(tiltFor('catering', priorities)).toBe(1.3);
    expect(tiltFor('photography', priorities)).toBe(1.2);
    expect(tiltFor('decor', priorities)).toBe(1.1);
    expect(tiltFor('venue', priorities)).toBe(1);
    expect(tiltFor('venue', [...priorities, 'venue'])).toBe(1);
  });

  it('bands feasibility by the shortfall against the typical need', () => {
    expect(feasibilityOf(rupees(-20_000), rupees(100_000))).toBe('comfortable');
    expect(feasibilityOf(rupees(-5000), rupees(100_000))).toBe('fits');
    expect(feasibilityOf(0, rupees(100_000))).toBe('fits');
    expect(feasibilityOf(rupees(8000), rupees(100_000))).toBe('tight');
    expect(feasibilityOf(rupees(30_000), rupees(100_000))).toBe('over');
    expect(feasibilityOf(0, 0)).toBe('comfortable');
  });
});

describe('Budget: Riya & Arjun sample (200 guests, ₹12 lakh, Pune)', () => {
  const budget = buildBudget(weddingParams());

  it('fits, so no line is planned below its typical cost', () => {
    for (const line of budget.lines) expect(line.planned).toBeGreaterThanOrEqual(line.typical);
  });

  it('fits, keeps the 8% reserve and labels every line an estimate', () => {
    expect(budget.feasibility).toBe('fits');
    expect(budget.contingencyTarget).toBe(rupees(96_000));
    expect(budget.contingency).toBeGreaterThanOrEqual(rupees(96_000));
    expect(budget.lines.map((line) => line.category)).toEqual(
      WEDDING.categories.map((entry) => entry.id),
    );
    expect(budget.lines.every((line) => line.provenance === 'estimate')).toBe(true);
  });

  it('adds up to the total to the rupee', () => {
    expect(plannedSum(weddingParams())).toBe(rupees(1_200_000));
  });

  it('gives the priorities a bigger share of their typical cost than other lines', () => {
    const share = (id: CategoryId): number => {
      const line = budget.lines.find((entry) => entry.category === id)!;
      return line.planned / line.typical;
    };
    expect(share('catering')).toBeGreaterThan(share('venue'));
    expect(share('photography')).toBeGreaterThan(share('decor'));
  });

  it('never moves a fixed line and spreads the rest', () => {
    const fixed: FixedLine = { amount: rupees(300_000), provenance: 'user', quoteId: null };
    const result = buildBudget(weddingParams({ fixed: { catering: fixed } }));
    const catering = result.lines.find((line) => line.category === 'catering')!;
    expect(catering.planned).toBe(rupees(300_000));
    expect(catering.provenance).toBe('user');
    expect(plannedSum(weddingParams({ fixed: { catering: fixed } }))).toBe(rupees(1_200_000));
  });

  it('protects priorities at their typical cost when they fit, and shares otherwise', () => {
    const protect = buildBudget(
      weddingParams({
        guests: 250,
        total: rupees(1_080_000),
        settings: { strategy: 'protect', formats: [], useContingency: false },
      }),
    );
    expect(protect.feasibility).toBe('over');
    for (const id of ['catering', 'photography'] as const) {
      const line = protect.lines.find((entry) => entry.category === id)!;
      expect(Math.abs(line.planned - line.typical)).toBeLessThan(ALLOCATION_STEP_PAISE);
    }
    const tiny = buildBudget(
      weddingParams({
        total: rupees(50_000),
        settings: { strategy: 'protect', formats: [], useContingency: false },
      }),
    );
    expect(tiny.feasibility).toBe('over');
    expect(sumPaise(tiny.lines.map((line) => line.planned)) + tiny.contingency).toBe(
      rupees(50_000),
    );
  });

  it('ignores a fixed amount for a category the event type does not use', () => {
    const fixed: FixedLine = { amount: rupees(40_000), provenance: 'user', quoteId: null };
    const params = weddingParams({ template: templateFor('birthday'), fixed: { rituals: fixed } });
    const result = buildBudget(params);
    expect(result.lines.some((line) => line.category === 'rituals')).toBe(false);
    expect(result.need).toBe(buildBudget({ ...params, fixed: {} }).need);
    expect(plannedSum(params)).toBe(params.total);
  });
});

describe('Budget: invariants for any event, total, guest count and fixed lines', () => {
  const arbitraryParams = fc
    .record({
      eventType: fc.constantFrom(...EVENT_TYPES),
      totalRupees: fc.integer({ min: LIMITS.minBudgetRupees, max: LIMITS.maxBudgetRupees }),
      guests: fc.integer({ min: 1, max: LIMITS.maxGuests }),
      strategy: fc.constantFrom(...STRATEGIES),
      useContingency: fc.boolean(),
      fixedRupees: fc.array(fc.integer({ min: 0, max: 2_000_000 }), { maxLength: 4 }),
      priorityCount: fc.integer({ min: 0, max: LIMITS.maxPriorities }),
    })
    .map((draw): BudgetParams => {
      const template = templateFor(draw.eventType);
      const ids = template.categories.map((entry) => entry.id);
      const fixed: Partial<Record<CategoryId, FixedLine>> = {};
      draw.fixedRupees.forEach((amount, i) => {
        fixed[ids[ids.length - 1 - i]!] = {
          amount: rupees(amount),
          provenance: 'quote',
          quoteId: `q${String(i)}`,
        };
      });
      return {
        total: rupees(draw.totalRupees),
        guests: draw.guests,
        template,
        priorities: ids.slice(0, draw.priorityCount),
        settings: { strategy: draw.strategy, formats: [], useContingency: draw.useContingency },
        fixed,
      };
    });

  it('Σ planned + contingency === total; fixed lines exact; estimates in ₹100 steps', () => {
    fc.assert(
      fc.property(arbitraryParams, (params) => {
        const budget = buildBudget(params);
        expect(sumPaise(budget.lines.map((line) => line.planned)) + budget.contingency).toBe(
          params.total,
        );
        for (const line of budget.lines) {
          const fixed = params.fixed[line.category];
          if (fixed === undefined) {
            expect(line.provenance).toBe('estimate');
            expect(line.planned).toBeGreaterThanOrEqual(0);
            expect(line.planned % ALLOCATION_STEP_PAISE).toBe(0);
          } else {
            expect(line.planned).toBe(fixed.amount);
          }
        }
        expect(budget.gap).toBe(budget.need - params.total);
        if (budget.gap <= 0) {
          for (const line of budget.lines) {
            if (line.provenance === 'estimate') {
              expect(line.planned).toBeGreaterThanOrEqual(line.typical - ALLOCATION_STEP_PAISE);
            }
          }
        }
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(arbitraryParams, (params) => {
        expect(buildBudget(params)).toEqual(buildBudget(params));
      }),
      { numRuns: 25 },
    );
  });
});
