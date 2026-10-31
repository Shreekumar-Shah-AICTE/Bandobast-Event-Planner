import { describe, expect, it } from 'vitest';
import type { Change } from '../../shared/schemas.js';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import { applyChange, applyChanges, describeChange, nextBudget } from './changes.js';
import { rupees } from './money.js';
import { initialInput } from './plan.js';

const input = initialInput(weddingProfile());
const SME: Change[] = [
  { kind: 'guests', mode: 'add', value: 50, evidence: '50 more guests' },
  { kind: 'budget', mode: 'addPct', value: -10, evidence: 'budget down 10%' },
  { kind: 'dateShift', value: -14, evidence: 'event 2 weeks earlier' },
];

describe('Change Test: applying "50 more guests, budget down 10%, event 2 weeks earlier"', () => {
  it('updates guests, budget and date together', () => {
    const result = applyChanges(input, SME, TODAY);
    expect(result.ok && result.value.profile).toMatchObject({
      guests: 250,
      budgetPaise: rupees(1_080_000),
      eventDate: '2027-02-04',
    });
  });

  it('labels each change chip in plain words', () => {
    expect(SME.map((change) => describeChange(change, input))).toEqual([
      'Guests 200 → 250',
      'Budget ₹12 lakh → ₹10.8 lakh',
      'Event 14 days earlier (4 Feb 2027)',
    ]);
  });
});

describe('Change Test: every change is validated, never half-applied', () => {
  it('rejects guest counts, budgets and dates outside the limits', () => {
    expect(
      applyChange(input, { kind: 'guests', mode: 'set', value: 6000, evidence: '' }, TODAY),
    ).toEqual({ ok: false, error: 'The guest count must stay between 1 and 5000.' });
    expect(
      applyChange(input, { kind: 'guests', mode: 'add', value: -200, evidence: '' }, TODAY).ok,
    ).toBe(false);
    const broke = applyChange(
      input,
      { kind: 'budget', mode: 'set', value: 500, evidence: '' },
      TODAY,
    );
    expect(broke).toEqual({
      ok: false,
      error: 'The budget must stay between ₹1,000 and ₹10 crore.',
    });
    expect(
      applyChange(input, { kind: 'dateSet', date: '2026-10-01', evidence: '' }, TODAY),
    ).toEqual({ ok: false, error: 'The event date must be after today.' });
    expect(applyChange(input, { kind: 'taskDone', taskId: 'ghost', evidence: '' }, TODAY)).toEqual({
      ok: false,
      error: 'There is no task called "ghost" in this plan.',
    });
  });

  it('stops at the first invalid change and keeps the plan as it was', () => {
    const result = applyChanges(
      input,
      [SME[0]!, { kind: 'dateShift', value: -200, evidence: '' }, SME[1]!],
      TODAY,
    );
    expect(result.ok).toBe(false);
    expect(input.profile.guests).toBe(200);
  });

  it('adds task delays up to 120 days and records when a task was done', () => {
    const delayed = applyChanges(
      input,
      [
        { kind: 'taskDelay', taskId: 'caterer', value: 100, evidence: '' },
        { kind: 'taskDelay', taskId: 'caterer', value: 100, evidence: '' },
        { kind: 'taskDone', taskId: 'venue', evidence: '' },
      ],
      TODAY,
    );
    expect(delayed.ok && delayed.value.tasks).toEqual({
      caterer: { done: false, delayDays: 120, compressed: false },
      venue: { done: true, doneOn: TODAY, delayDays: 0, compressed: false },
    });
  });

  it('computes the next budget for add, percent and set', () => {
    const now = rupees(1_200_000);
    expect(nextBudget(now, { kind: 'budget', mode: 'add', value: 50_000, evidence: '' })).toBe(
      rupees(1_250_000),
    );
    expect(nextBudget(now, { kind: 'budget', mode: 'addPct', value: 5, evidence: '' })).toBe(
      rupees(1_260_000),
    );
    expect(nextBudget(now, { kind: 'budget', mode: 'set', value: 900_000, evidence: '' })).toBe(
      rupees(900_000),
    );
  });

  it('labels set, delay, done and later-date chips', () => {
    expect(
      [
        { kind: 'guests', mode: 'set', value: 150, evidence: '' },
        { kind: 'dateSet', date: '2027-02-19', evidence: '' },
        { kind: 'taskDelay', taskId: 'caterer', value: 5, evidence: '' },
        { kind: 'taskDone', taskId: 'venue', evidence: '' },
      ].map((change) => describeChange(change as Change, input)),
    ).toEqual([
      'Guests 200 → 150',
      'Event 1 day later (19 Feb 2027)',
      expect.stringMatching(/: 5 days late$/u),
      expect.stringMatching(/^Done: /u),
    ]);
  });
});

describe('Change Test: labels for tasks outside the template', () => {
  it('falls back to the task id', () => {
    expect(describeChange({ kind: 'taskDone', taskId: 'ghost', evidence: '' }, input)).toBe(
      'Done: ghost',
    );
  });
});
