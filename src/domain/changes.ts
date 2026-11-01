/**
 * Applying a confirmed ChangeSet to the plan inputs. Each change is validated
 * against the current plan; invalid changes are reported, never half-applied.
 */
import type { Change, PlanInput } from '../../shared/schemas.js';
import { LIMITS } from '../../shared/limits.js';
import { addDays, daysBetween, formatDate, type IsoDate } from './dates.js';
import { applyPercent, formatCompact, rupees, type Paise } from './money.js';
import { err, ok, type Result } from './result.js';
import { templateFor } from './templates/index.js';
import { DEFAULT_TASK_STATE } from './timeline.js';

const MIN_BUDGET: Paise = rupees(LIMITS.minBudgetRupees);
const MAX_BUDGET: Paise = rupees(LIMITS.maxBudgetRupees);

function nextGuests(
  input: PlanInput,
  change: Extract<Change, { kind: 'guests' }>,
): Result<PlanInput, string> {
  const guests = change.mode === 'add' ? input.profile.guests + change.value : change.value;
  if (guests < 1 || guests > LIMITS.maxGuests) {
    return err(`The guest count must stay between 1 and ${String(LIMITS.maxGuests)}.`);
  }
  return ok({ ...input, profile: { ...input.profile, guests } });
}

/** The new total budget for a budget change. O(1). */
export function nextBudget(current: Paise, change: Extract<Change, { kind: 'budget' }>): Paise {
  if (change.mode === 'set') return rupees(change.value);
  return change.mode === 'add'
    ? current + rupees(change.value)
    : applyPercent(current, change.value);
}

function withBudget(
  input: PlanInput,
  change: Extract<Change, { kind: 'budget' }>,
): Result<PlanInput, string> {
  const budgetPaise = nextBudget(input.profile.budgetPaise, change);
  if (budgetPaise < MIN_BUDGET || budgetPaise > MAX_BUDGET) {
    return err(
      `The budget must stay between ${formatCompact(MIN_BUDGET)} and ${formatCompact(MAX_BUDGET)}.`,
    );
  }
  return ok({ ...input, profile: { ...input.profile, budgetPaise } });
}

function withDate(input: PlanInput, eventDate: IsoDate, today: IsoDate): Result<PlanInput, string> {
  if (eventDate <= today) return err('The event date must be after today.');
  return ok({ ...input, profile: { ...input.profile, eventDate } });
}

function withTask(
  input: PlanInput,
  taskId: string,
  update: (state: PlanInput['tasks'][string]) => PlanInput['tasks'][string],
): Result<PlanInput, string> {
  const known = templateFor(input.profile.eventType).tasks.some((task) => task.id === taskId);
  if (!known) return err(`There is no task called "${taskId}" in this plan.`);
  const state = input.tasks[taskId] ?? DEFAULT_TASK_STATE;
  return ok({ ...input, tasks: { ...input.tasks, [taskId]: update(state) } });
}

/** Applies one change, or explains why it cannot be applied. O(t) for t tasks. */
export function applyChange(
  input: PlanInput,
  change: Change,
  today: IsoDate,
): Result<PlanInput, string> {
  switch (change.kind) {
    case 'guests':
      return nextGuests(input, change);
    case 'budget':
      return withBudget(input, change);
    case 'dateShift':
      return withDate(input, addDays(input.profile.eventDate, change.value), today);
    case 'dateSet':
      return withDate(input, change.date, today);
    case 'taskDelay':
      return withTask(input, change.taskId, (state) => ({
        ...state,
        delayDays: Math.min(LIMITS.maxDelayDays, state.delayDays + change.value),
      }));
    case 'taskDone':
      return withTask(input, change.taskId, (state) => ({ ...state, done: true, doneOn: today }));
  }
}

/** Applies every change in order; stops at the first invalid one. O(k · t). */
export function applyChanges(
  input: PlanInput,
  changes: readonly Change[],
  today: IsoDate,
): Result<PlanInput, string> {
  let current: Result<PlanInput, string> = ok(input);
  for (const change of changes) {
    if (!current.ok) break;
    current = applyChange(current.value, change, today);
  }
  return current;
}

function taskTitle(input: PlanInput, taskId: string): string {
  return (
    templateFor(input.profile.eventType).tasks.find((task) => task.id === taskId)?.title ?? taskId
  );
}

function describeShift(days: number): string {
  const size = Math.abs(days);
  return `Event ${String(size)} day${size === 1 ? '' : 's'} ${days < 0 ? 'earlier' : 'later'}`;
}

/** A short human label for a change chip, e.g. "Guests 200 → 250". O(t). */
export function describeChange(change: Change, input: PlanInput): string {
  const { profile } = input;
  switch (change.kind) {
    case 'guests': {
      const after = change.mode === 'add' ? profile.guests + change.value : change.value;
      return `Guests ${String(profile.guests)} → ${String(after)}`;
    }
    case 'budget':
      return `Budget ${formatCompact(profile.budgetPaise)} → ${formatCompact(nextBudget(profile.budgetPaise, change))}`;
    case 'dateShift':
      return `${describeShift(change.value)} (${formatDate(addDays(profile.eventDate, change.value))})`;
    case 'dateSet':
      return `${describeShift(daysBetween(profile.eventDate, change.date))} (${formatDate(change.date)})`;
    case 'taskDelay':
      return `${taskTitle(input, change.taskId)}: ${String(change.value)} days late`;
    case 'taskDone':
      return `Done: ${taskTitle(input, change.taskId)}`;
  }
}

/**
 * Labels for a list of changes, each read against the plan as the chosen changes
 * before it left it, so "+50 guests, then +20" reads 200 → 250, then 250 → 270.
 * Unticked (skipped) or invalid changes leave the running plan as it was. O(k · t).
 */
export function describeChanges(
  input: PlanInput,
  changes: readonly Change[],
  today: IsoDate,
  skipped: ReadonlySet<number> = new Set(),
): string[] {
  let current = input;
  return changes.map((change, index) => {
    const label = describeChange(change, current);
    if (!skipped.has(index)) {
      const next = applyChange(current, change, today);
      if (next.ok) current = next.value;
    }
    return label;
  });
}
