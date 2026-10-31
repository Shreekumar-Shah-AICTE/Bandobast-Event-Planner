import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PlanInput } from '../../shared/schemas.js';
import { TODAY, quote, weddingProfile } from '../test/fixtures.js';
import { applyChanges } from './changes.js';
import { parseChangeText } from './changeParser.js';
import { diffPlans } from './diff.js';
import { rupees, sumPaise } from './money.js';
import { addVersion, buildPlan, firstVersion, initialInput, type Plan } from './plan.js';
import { templateFor } from './templates/index.js';

const SME_TEXT = '50 more guests, budget down 10%, event 2 weeks earlier';
const before = buildPlan(initialInput(weddingProfile()), TODAY);

function afterChange(input: PlanInput, text: string): Plan {
  const { changes } = parseChangeText(text, templateFor(input.profile.eventType).tasks, TODAY);
  const next = applyChanges(input, changes, TODAY);
  if (!next.ok) throw new Error(next.error);
  return buildPlan(next.value, TODAY);
}

const adds = (plan: Plan): boolean =>
  sumPaise(plan.budget.lines.map((line) => line.planned)) + plan.budget.contingency ===
  plan.input.profile.budgetPaise;

describe('Change Test: impact report for "50 more guests, budget down 10%, event 2 weeks earlier"', () => {
  const after = afterChange(before.input, SME_TEXT);
  const report = diffPlans(before, after);

  it('shows the new guests, budget and date', () => {
    expect(report.guests).toEqual({ before: 200, after: 250 });
    expect(report.budget).toEqual({ before: rupees(1_200_000), after: rupees(1_080_000) });
    expect(report.eventDate).toEqual({ before: '2027-02-18', after: '2027-02-04' });
    expect(report.isEmpty).toBe(false);
  });

  it('turns a fitting budget into a ₹1,53,900 shortfall with three ways to rebalance', () => {
    expect(report.feasibility).toEqual({ before: 'fits', after: 'over' });
    expect(report.gap).toEqual({ before: rupees(-52_000), after: rupees(153_900) });
    expect(report.contingency).toEqual({ before: rupees(96_000), after: rupees(86_400) });
    expect(after.scenarios.map((s) => s.id)).toEqual(['protect', 'share', 'format']);
    expect(report.lines.length).toBeGreaterThan(0);
  });

  it('names the tasks that are now late or tight and counts every moved deadline', () => {
    expect(report.newlyLate.map((t) => t.id)).toEqual(['muhurat', 'venue']);
    expect(report.newlyTight.map((t) => t.id)).toEqual(['caterer']);
    expect(report.recovered).toEqual([]);
    expect(report.movedTasks).toBe(13);
    expect(after.tips.map((t) => t.taskId)).toEqual(['venue', 'muhurat']);
  });

  it('keeps the money adding up before and after', () => {
    expect(adds(before)).toBe(true);
    expect(adds(after)).toBe(true);
  });
});

describe('Change Test: fixed lines and quotes through a change', () => {
  const withQuote: PlanInput = {
    ...before.input,
    quotes: [quote()],
    overrides: {
      catering: { kind: 'quote', quoteId: 'q1', booked: false },
      photography: { kind: 'user', amountPaise: rupees(150_000) },
    },
  };
  const quoted = buildPlan(withQuote, TODAY);

  it('uses the quote total for its line, labelled as a quote', () => {
    const line = quoted.budget.lines.find((l) => l.category === 'catering')!;
    expect(line).toMatchObject({ provenance: 'quote', planned: rupees(249_375), quoteId: 'q1' });
    expect(quoted.vendors.find((v) => v.category === 'catering')?.quoteCount).toBe(1);
    expect(adds(quoted)).toBe(true);
  });

  it('re-prices the quoted line for the new guest count and leaves your own number alone', () => {
    const report = diffPlans(quoted, afterChange(withQuote, '300 guests'));
    expect(report.quotes).toEqual([
      {
        id: 'q1',
        vendorName: 'Shree Ganesh Caterers',
        before: rupees(249_375),
        after: rupees(294_000),
      },
    ]);
    expect(report.lines.find((l) => l.category === 'catering')).toMatchObject({
      provenance: 'quote',
      after: rupees(294_000),
    });
    expect(report.untouched).toContain('photography');
  });

  it('labels a booked quote as booked and ignores an override for a missing quote', () => {
    const booked = buildPlan(
      { ...withQuote, overrides: { catering: { kind: 'quote', quoteId: 'q1', booked: true } } },
      TODAY,
    );
    expect(booked.budget.lines.find((l) => l.category === 'catering')?.provenance).toBe('booked');
    const missing = buildPlan(
      { ...withQuote, overrides: { catering: { kind: 'quote', quoteId: 'gone', booked: false } } },
      TODAY,
    );
    expect(missing.budget.lines.find((l) => l.category === 'catering')?.provenance).toBe(
      'estimate',
    );
  });

  it('reports a recovered task when the date moves back', () => {
    const late = afterChange(before.input, 'event 2 weeks earlier');
    const back = afterChange(late.input, 'event 2 weeks later');
    expect(diffPlans(late, back).recovered.map((t) => t.id)).toEqual(['muhurat', 'venue']);
  });
});

describe('Plan: deterministic, versioned and self-consistent', () => {
  it('builds the same plan from the same inputs, and a self-diff is empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 50_000, max: 5_000_000 }),
        (guests, budget) => {
          const input = initialInput(weddingProfile({ guests, budgetPaise: rupees(budget) }));
          const plan = buildPlan(input, TODAY);
          expect(buildPlan(input, TODAY)).toEqual(plan);
          expect(diffPlans(plan, plan).isEmpty).toBe(true);
          expect(adds(plan)).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('numbers versions after the newest, keeps 30, and trims long labels', () => {
    const first = firstVersion(weddingProfile(), TODAY);
    expect(first).toMatchObject({ version: 1, label: 'First plan' });
    let history = [first];
    for (let i = 0; i < 35; i += 1) {
      history = addVersion(history, { input: first.input, label: 'x'.repeat(200), today: TODAY });
    }
    expect(history).toHaveLength(30);
    expect(history.at(-1)?.version).toBe(36);
    expect(history.at(-1)?.label).toHaveLength(160);
    const withChanges = addVersion([first], {
      input: first.input,
      label: SME_TEXT,
      today: TODAY,
      changes: [{ kind: 'dateShift', value: -14, evidence: 'event 2 weeks earlier' }],
    });
    expect(withChanges[1]?.changes).toHaveLength(1);
  });
});

describe('Change Test: reports across event types and unchanged quotes', () => {
  it('treats lines and tasks new to the other event type as added', () => {
    const birthday = buildPlan(initialInput(weddingProfile({ eventType: 'birthday' })), TODAY);
    const report = diffPlans(birthday, before);
    expect(report.lines.find((l) => l.category === 'rituals')?.before).toBe(0);
    expect(report.newlyLate).toEqual([]);
  });

  it('lists no quote change when the quote total is the same', () => {
    const quoted = buildPlan({ ...before.input, quotes: [quote()] }, TODAY);
    const again = afterChange(quoted.input, '210 guests');
    expect(diffPlans(quoted, again).quotes).toEqual([]);
  });
});
