import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/limits.js';
import { CustomTaskSchema, type PlanInput } from '../../shared/schemas.js';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import { addCustomTask, removeCustomTask } from './customTasks.js';
import { addDays } from './dates.js';
import { buildPlan, initialInput } from './plan.js';

const base = (eventDate = '2027-02-18') => initialInput(weddingProfile({ eventDate }));

function added(title: string, dueOn: string, input: PlanInput = base()): PlanInput {
  const result = addCustomTask(input, { title, dueOn }, TODAY);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const mine = (input: PlanInput, today = TODAY) =>
  buildPlan(input, today).schedule.tasks.find((task) => task.id === 'my1');

const problem = (title: string, dueOn: string, input = base()) => {
  const result = addCustomTask(input, { title, dueOn }, TODAY);
  return result.ok ? null : result.error;
};

describe('custom tasks', () => {
  it('are due on their own date, off the critical path, and move with the event', () => {
    const input = added('Book the mehendi artist', '2027-01-10');
    expect(mine(input)).toMatchObject({ due: '2027-01-10', status: 'ok', critical: false });
    const earlier = { ...input, profile: { ...input.profile, eventDate: '2027-02-04' } };
    expect(mine(earlier)?.due).toBe('2026-12-27');
  });

  it('turn tight near their date, late after it, and done when ticked', () => {
    const input = added('Collect the outfits', addDays(TODAY, 2));
    expect(mine(input)?.status).toBe('tight');
    const later = addDays(TODAY, 3);
    expect(mine(input, later)?.status).toBe('late');
    expect(buildPlan(input, later).schedule.lateCount).toBeGreaterThan(0);
    const ticked = {
      ...input,
      tasks: { my1: { done: true, doneOn: TODAY, delayDays: 0, compressed: false } },
    };
    expect(mine(ticked, later)?.status).toBe('done');
    expect(removeCustomTask(ticked, 'my1')).toMatchObject({ customTasks: [], tasks: {} });
  });

  it('check the name and the date', () => {
    expect(problem('  ', '2027-01-10')).toMatch(/Name the task/);
    expect(problem('x'.repeat(LIMITS.maxTitleLength + 1), '2027-01-10')).toMatch(/under 80/);
    expect(problem('Gifts', '')).toMatch(/Choose the date/);
    expect(problem('Gifts', addDays(TODAY, -1))).toMatch(/today or a later/);
    expect(problem('Return the chairs', '2027-05-01')).toMatch(/60 days after the event/);
    expect(problem('Save the date', TODAY, base('2032-06-01'))).toMatch(/five years/);
  });

  it('never reuse an id and stop at the limit', () => {
    const two = added('Second', '2027-01-12', added('First', '2027-01-11'));
    const third = added('Third', '2027-01-13', removeCustomTask(two, 'my1'));
    expect(third.customTasks.map((task) => task.id)).toEqual(['my2', 'my3']);
    expect(
      CustomTaskSchema.safeParse({ id: 'my1000', title: 'Task', daysBefore: 10 }).success,
    ).toBe(true);
    const full = {
      ...base(),
      customTasks: Array.from({ length: LIMITS.maxCustomTasks }, (_, index) => ({
        id: `my${String(index + 1)}`,
        title: 'Task',
        daysBefore: 10,
      })),
    };
    expect(problem('One more', '2027-01-10', full)).toMatch(/Remove one first/);
  });
});
