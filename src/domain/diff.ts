/**
 * Impact Report: what moved between two plan versions — profile, every budget
 * line, the reserve, feasibility, tasks that became late or recovered, and how
 * each quote's total changed. The diff of a plan with itself is empty.
 */
import type { CategoryId } from '../../shared/schemas.js';
import type { Feasibility, Provenance } from './budget.js';
import type { IsoDate } from './dates.js';
import type { Paise } from './money.js';
import type { Plan } from './plan.js';
import type { TaskStatus } from './timeline.js';

/** A value before and after a change. */
export interface Delta<T> {
  readonly before: T;
  readonly after: T;
}

/** A budget line whose amount moved, with the label of its new amount. */
export interface LineDelta extends Delta<Paise> {
  readonly category: CategoryId;
  readonly provenance: Provenance;
}

/** A task whose status, slack or due date moved. */
export interface TaskDelta {
  readonly id: string;
  readonly title: string;
  readonly status: Delta<TaskStatus>;
  readonly slack: Delta<number>;
  readonly due: Delta<IsoDate>;
}

/** A quote whose total moved, for example after a guest change. */
export interface QuoteDelta extends Delta<Paise> {
  readonly id: string;
  readonly vendorName: string;
}

/**
 * Everything one change moved: guests, budget and date (null when unchanged), budget lines, the
 * reserve, the budget check, tasks that became late, tight or recovered, and quote totals.
 */
export interface ImpactReport {
  readonly guests: Delta<number> | null;
  readonly budget: Delta<Paise> | null;
  readonly eventDate: Delta<IsoDate> | null;
  readonly lines: readonly LineDelta[];
  /** Fixed lines (your number, quote, booked) that the change left untouched. */
  readonly untouched: readonly CategoryId[];
  readonly contingency: Delta<Paise>;
  readonly feasibility: Delta<Feasibility>;
  readonly gap: Delta<Paise>;
  readonly newlyLate: readonly TaskDelta[];
  readonly newlyTight: readonly TaskDelta[];
  readonly recovered: readonly TaskDelta[];
  readonly movedTasks: number;
  readonly quotes: readonly QuoteDelta[];
  readonly isEmpty: boolean;
}

const changed = <T>(before: T, after: T): Delta<T> | null =>
  before === after ? null : { before, after };

function lineDeltas(before: Plan, after: Plan): { lines: LineDelta[]; untouched: CategoryId[] } {
  const previous = new Map(before.budget.lines.map((line) => [line.category, line]));
  const lines: LineDelta[] = [];
  const untouched: CategoryId[] = [];
  for (const line of after.budget.lines) {
    const old = previous.get(line.category)?.planned ?? 0;
    if (old !== line.planned)
      lines.push({
        category: line.category,
        provenance: line.provenance,
        before: old,
        after: line.planned,
      });
    else if (line.provenance !== 'estimate') untouched.push(line.category);
  }
  return { lines, untouched };
}

function taskDeltas(before: Plan, after: Plan): TaskDelta[] {
  const previous = new Map(before.schedule.tasks.map((task) => [task.id, task]));
  return after.schedule.tasks.flatMap((task) => {
    const old = previous.get(task.id);
    if (old === undefined) return [];
    return [
      {
        id: task.id,
        title: task.title,
        status: { before: old.status, after: task.status },
        slack: { before: old.slack, after: task.slack },
        due: { before: old.due, after: task.due },
      },
    ];
  });
}

function quoteDeltas(before: Plan, after: Plan): QuoteDelta[] {
  const previous = new Map(before.quotes.map((entry) => [entry.quote.id, entry.high]));
  return after.quotes.flatMap((entry) => {
    const old = previous.get(entry.quote.id);
    return old === undefined || old === entry.high
      ? []
      : [
          {
            id: entry.quote.id,
            vendorName: entry.quote.vendorName,
            before: old,
            after: entry.high,
          },
        ];
  });
}

/** Compares two plans. O(c + t + q). */
export function diffPlans(before: Plan, after: Plan): ImpactReport {
  const a = before.input.profile;
  const b = after.input.profile;
  const { lines, untouched } = lineDeltas(before, after);
  const tasks = taskDeltas(before, after);
  const report = {
    guests: changed(a.guests, b.guests),
    budget: changed(a.budgetPaise, b.budgetPaise),
    eventDate: changed(a.eventDate, b.eventDate),
    lines,
    untouched,
    contingency: { before: before.budget.contingency, after: after.budget.contingency },
    feasibility: { before: before.budget.feasibility, after: after.budget.feasibility },
    gap: { before: before.budget.gap, after: after.budget.gap },
    newlyLate: tasks.filter((t) => t.status.after === 'late' && t.status.before !== 'late'),
    newlyTight: tasks.filter((t) => t.status.after === 'tight' && t.status.before === 'ok'),
    recovered: tasks.filter((t) => t.status.before === 'late' && t.status.after !== 'late'),
    movedTasks: tasks.filter((t) => t.due.before !== t.due.after).length,
    quotes: quoteDeltas(before, after),
  };
  const isEmpty = [
    report.guests === null,
    report.budget === null,
    report.eventDate === null,
    lines.length === 0,
    report.contingency.before === report.contingency.after,
    tasks.every((t) => t.status.before === t.status.after && t.due.before === t.due.after),
    report.quotes.length === 0,
  ].every(Boolean);
  return { ...report, isEmpty };
}
