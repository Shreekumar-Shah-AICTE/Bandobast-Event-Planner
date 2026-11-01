/**
 * Timeline engine: tasks with dependencies scheduled forward from today and
 * backward from their due dates (critical-path method on day numbers).
 * Slack = latest finish − earliest finish; negative slack means late.
 */
import type { CategoryId, TaskState } from '../../shared/schemas.js';
import { TIGHT_SLACK_DAYS } from './constants.js';
import { addDays, toDayNumber, type IsoDate } from './dates.js';
import { err, ok, type Result } from './result.js';
import type { TaskTemplate } from './templates/index.js';
import { lookup } from './access.js';

export type TaskStatus = 'done' | 'late' | 'tight' | 'ok';

export interface ScheduledTask {
  readonly id: string;
  readonly title: string;
  readonly category: CategoryId | null;
  readonly dependsOn: readonly string[];
  readonly start: IsoDate;
  readonly finish: IsoDate;
  readonly latestStart: IsoDate;
  readonly due: IsoDate;
  readonly slack: number;
  readonly status: TaskStatus;
  readonly critical: boolean;
  readonly durationDays: number;
  readonly delayDays: number;
  readonly compressed: boolean;
  /** Days that compressing this task would recover (0 when already compressed). */
  readonly savingDays: number;
  readonly tip: string | null;
  readonly custom: boolean;
}

export interface Schedule {
  readonly tasks: readonly ScheduledTask[];
  /** Open built-in tasks with the least slack, in dependency order. */
  readonly criticalPath: readonly string[];
  readonly lateCount: number;
}

export type GraphError =
  | { readonly kind: 'unknownDependency'; readonly taskId: string; readonly dependsOn: string }
  | { readonly kind: 'cycle'; readonly taskIds: readonly string[] };

interface Node {
  readonly id: string;
  readonly dependsOn: readonly string[];
}

export const DEFAULT_TASK_STATE: TaskState = { done: false, delayDays: 0, compressed: false };

function successorsOf(nodes: readonly Node[]): Result<Map<string, string[]>, GraphError> {
  const ids = new Set(nodes.map((node) => node.id));
  const successors = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const node of nodes) {
    const unknown = node.dependsOn.find((dep) => !ids.has(dep));
    if (unknown !== undefined) {
      return err({ kind: 'unknownDependency', taskId: node.id, dependsOn: unknown });
    }
    for (const dep of node.dependsOn) lookup(successors, dep).push(node.id);
  }
  return ok(successors);
}

/**
 * Topological order by Kahn's algorithm (ties keep input order). Fails on unknown
 * dependencies or a cycle (returns the tasks left on the cycle). O(V + E).
 */
export function topoOrder(nodes: readonly Node[]): Result<string[], GraphError> {
  const graph = successorsOf(nodes);
  if (!graph.ok) return graph;
  const indegree = new Map(nodes.map((node) => [node.id, node.dependsOn.length]));
  const queue = nodes.filter((node) => node.dependsOn.length === 0).map((node) => node.id);
  const order: string[] = [];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    order.push(next);
    for (const succ of lookup(graph.value, next)) {
      const remaining = lookup(indegree, succ) - 1;
      indegree.set(succ, remaining);
      if (remaining === 0) queue.push(succ);
    }
  }
  if (order.length === nodes.length) return ok(order);
  const placed = new Set(order);
  return err({ kind: 'cycle', taskIds: nodes.map((n) => n.id).filter((id) => !placed.has(id)) });
}

interface Timing {
  readonly es: number;
  readonly ef: number;
}

const effectiveDuration = (task: TaskTemplate, state: TaskState): number =>
  state.done ? 0 : (state.compressed ? task.minDurationDays : task.durationDays) + state.delayDays;

function forwardPass(
  order: readonly TaskTemplate[],
  states: Readonly<Record<string, TaskState>>,
  today: number,
): Map<string, Timing> {
  const timing = new Map<string, Timing>();
  for (const task of order) {
    const state = states[task.id] ?? DEFAULT_TASK_STATE;
    const ready = Math.max(today, ...task.dependsOn.map((dep) => lookup(timing, dep).ef));
    const es = state.done && state.doneOn !== undefined ? toDayNumber(state.doneOn) : ready;
    timing.set(task.id, { es, ef: es + effectiveDuration(task, state) });
  }
  return timing;
}

function backwardPass(
  order: readonly TaskTemplate[],
  timing: ReadonlyMap<string, Timing>,
  eventDay: number,
): Map<string, number> {
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();
  for (const task of [...order].reverse()) {
    const successorStarts = order
      .filter((other) => other.dependsOn.includes(task.id))
      .map((other) => lookup(latestStart, other.id));
    const lf = Math.min(eventDay - task.leadDays, ...successorStarts);
    const t = lookup(timing, task.id);
    latestFinish.set(task.id, lf);
    latestStart.set(task.id, lf - (t.ef - t.es));
  }
  return latestFinish;
}

function statusOf(done: boolean, slack: number): TaskStatus {
  if (done) return 'done';
  if (slack < 0) return 'late';
  return slack <= TIGHT_SLACK_DAYS ? 'tight' : 'ok';
}

/** Parameters for {@link schedule}. */
export interface ScheduleParams {
  readonly tasks: readonly TaskTemplate[];
  readonly states: Readonly<Record<string, TaskState>>;
  readonly eventDate: IsoDate;
  readonly today: IsoDate;
}

/**
 * Schedules every task: earliest start/finish from today and dependencies, latest
 * finish from the due date and successors, slack, status and the critical path.
 * Template graphs are validated by tests; an invalid graph yields an empty schedule.
 * O(V · (V + E)) — the backward pass scans successors per task; V ≤ 15 in practice.
 */
export function schedule(params: ScheduleParams): Schedule {
  const sorted = topoOrder(params.tasks);
  if (!sorted.ok) return { tasks: [], criticalPath: [], lateCount: 0 };
  const byId = new Map(params.tasks.map((task) => [task.id, task]));
  const order = sorted.value.map((id) => lookup(byId, id));
  const today = toDayNumber(params.today);
  const timing = forwardPass(order, params.states, today);
  const latestFinish = backwardPass(order, timing, toDayNumber(params.eventDate));
  const rows = order.map((task) => toScheduled(task, params, timing, latestFinish));
  const onPath = (row: ScheduledTask): boolean => row.status !== 'done' && !row.custom;
  const minSlack = Math.min(...rows.filter(onPath).map((row) => row.slack));
  const tasks = rows.map((row) => ({ ...row, critical: onPath(row) && row.slack === minSlack }));
  return {
    tasks,
    criticalPath: tasks.filter((row) => row.critical).map((row) => row.id),
    lateCount: tasks.filter((row) => row.status === 'late').length,
  };
}

function toScheduled(
  task: TaskTemplate,
  params: ScheduleParams,
  timing: ReadonlyMap<string, Timing>,
  latestFinish: ReadonlyMap<string, number>,
): ScheduledTask {
  const state = params.states[task.id] ?? DEFAULT_TASK_STATE;
  const t = lookup(timing, task.id);
  const lf = lookup(latestFinish, task.id);
  const slack = lf - t.ef;
  const base = toDayNumber(params.today);
  const at = (day: number): IsoDate => addDays(params.today, day - base);
  return {
    id: task.id,
    title: task.title,
    category: task.category ?? null,
    dependsOn: task.dependsOn,
    start: at(t.es),
    finish: at(t.ef),
    latestStart: at(lf - (t.ef - t.es)),
    due: at(lf),
    slack,
    status: statusOf(state.done, slack),
    critical: false,
    durationDays: t.ef - t.es,
    delayDays: state.delayDays,
    compressed: state.compressed,
    savingDays: state.done || state.compressed ? 0 : task.durationDays - task.minDurationDays,
    tip: task.tip ?? null,
    custom: task.custom ?? false,
  };
}

/** A way to recover time on a late task. */
export interface CompressionTip {
  readonly taskId: string;
  readonly title: string;
  readonly text: string;
  readonly savingDays: number;
  /** True when the saving alone clears the lateness. */
  readonly clears: boolean;
}

/** Late tasks that can be shortened, biggest saving first. O(V log V). */
export function compressionTips(plan: Schedule): readonly CompressionTip[] {
  return plan.tasks
    .filter((task) => task.status === 'late' && task.savingDays > 0)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      text: task.tip ?? `Shorten this step to ${String(task.durationDays - task.savingDays)} days.`,
      savingDays: task.savingDays,
      clears: task.savingDays >= -task.slack,
    }))
    .sort((a, b) => b.savingDays - a.savingDays);
}
