/**
 * Tasks the user adds to the built-in timeline. Each is stored as days before the
 * event, so it moves with the event date, and is scheduled with no duration and no
 * dependencies: it turns late only after its own due date. Pure.
 */
import { LIMITS } from '../../shared/limits.js';
import { CustomTaskSchema, type CustomTask, type PlanInput } from '../../shared/schemas.js';
import { daysBetween, isIsoDate, type IsoDate } from './dates.js';
import { err, ok, type Result } from './result.js';
import type { TaskTemplate } from './templates/index.js';

/** A custom task as the scheduler sees it. O(1). */
export const asTemplate = (task: CustomTask): TaskTemplate => ({
  id: task.id,
  title: task.title,
  leadDays: task.daysBefore,
  durationDays: 0,
  minDurationDays: 0,
  dependsOn: [],
  keywords: [],
  custom: true,
});

export interface CustomTaskDraft {
  readonly title: string;
  readonly dueOn: string;
}

/** Next free id ("my1", "my2", …); built-in task ids are words, so they never clash. O(t). */
const nextId = (tasks: readonly CustomTask[]): string => {
  const used = tasks.map((task) => Number(task.id.slice(2)));
  return `my${String(Math.max(0, ...used) + 1)}`;
};

/** Adds a task due on `draft.dueOn`, from today up to a little after the event. O(t). */
export function addCustomTask(
  input: PlanInput,
  draft: CustomTaskDraft,
  today: IsoDate,
): Result<PlanInput, string> {
  if (input.customTasks.length >= LIMITS.maxCustomTasks) {
    return err(
      `A plan can hold ${String(LIMITS.maxCustomTasks)} of your own tasks. Remove one first.`,
    );
  }
  const title = draft.title.trim();
  if (title === '') return err('Name the task, for example "Book the mehendi artist".');
  if (title.length > LIMITS.maxTitleLength) {
    return err(`Keep the name under ${String(LIMITS.maxTitleLength)} characters.`);
  }
  if (!isIsoDate(draft.dueOn)) return err('Choose the date this task is due.');
  if (draft.dueOn < today) return err('Choose today or a later date.');
  const task = CustomTaskSchema.safeParse({
    id: nextId(input.customTasks),
    title,
    daysBefore: daysBetween(draft.dueOn, input.profile.eventDate),
  });
  if (!task.success) {
    return err(
      `Choose a date up to ${String(LIMITS.maxDaysAfterEvent)} days after the event and at most five years before it.`,
    );
  }
  return ok({ ...input, customTasks: [...input.customTasks, task.data] });
}

/** Removes a custom task and its tick. O(t). */
export function removeCustomTask(input: PlanInput, id: string): PlanInput {
  const { [id]: _removed, ...tasks } = input.tasks;
  return { ...input, customTasks: input.customTasks.filter((task) => task.id !== id), tasks };
}
