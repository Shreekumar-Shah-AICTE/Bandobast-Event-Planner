/** Plan-input edits for one task: tick it done (or not), or shorten it. */
import type { PlanInput, TaskState } from '../../../shared/schemas.js';
import type { IsoDate } from '../../domain/dates.js';
import { DEFAULT_TASK_STATE } from '../../domain/timeline.js';

const stateOf = (input: PlanInput, taskId: string): TaskState =>
  input.tasks[taskId] ?? DEFAULT_TASK_STATE;

const withTask = (input: PlanInput, taskId: string, state: TaskState): PlanInput => ({
  ...input,
  tasks: { ...input.tasks, [taskId]: state },
});

/** Marks a task done today, or open again. O(t). */
export function setDone(
  input: PlanInput,
  taskId: string,
  done: boolean,
  today: IsoDate,
): PlanInput {
  const { doneOn: _previous, ...rest } = stateOf(input, taskId);
  return withTask(input, taskId, done ? { ...rest, done, doneOn: today } : { ...rest, done });
}

/** Shortens a task to its minimum realistic duration. O(t). */
export const compress = (input: PlanInput, taskId: string): PlanInput =>
  withTask(input, taskId, { ...stateOf(input, taskId), compressed: true });
