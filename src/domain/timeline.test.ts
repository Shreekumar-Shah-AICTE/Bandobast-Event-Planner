import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, type TaskState } from '../../shared/schemas.js';
import { TODAY } from '../test/fixtures.js';
import { addDays, toDayNumber } from './dates.js';
import { templateFor, type TaskTemplate } from './templates/index.js';
import { compressionTips, schedule, topoOrder, type Schedule } from './timeline.js';

const TASKS = templateFor('wedding').tasks;
const EVENT = '2027-02-18';
const EARLIER = addDays(EVENT, -14);

const plan = (states: Record<string, TaskState> = {}, eventDate = EVENT): Schedule =>
  schedule({ tasks: TASKS, states, eventDate, today: TODAY });
const task = (s: Schedule, id: string) => s.tasks.find((t) => t.id === id)!;
const state = (overrides: Partial<TaskState>): TaskState => ({
  done: false,
  delayDays: 0,
  compressed: false,
  ...overrides,
});

function descendants(tasks: readonly TaskTemplate[], id: string): Set<string> {
  const found = new Set<string>();
  const visit = (current: string): void => {
    for (const next of tasks.filter((t) => t.dependsOn.includes(current))) {
      if (!found.has(next.id)) {
        found.add(next.id);
        visit(next.id);
      }
    }
  };
  visit(id);
  return found;
}

describe('Timeline: every template is a valid dependency graph', () => {
  it.each(EVENT_TYPES)('%s tasks have known dependencies, no cycles and sane durations', (type) => {
    const { tasks, categories, formats } = templateFor(type);
    const order = topoOrder(tasks);
    expect(order.ok).toBe(true);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    const ids = new Set(categories.map((c) => c.id));
    for (const t of tasks) {
      expect(t.minDurationDays).toBeGreaterThan(0);
      expect(t.minDurationDays).toBeLessThanOrEqual(t.durationDays);
      expect(t.keywords.length).toBeGreaterThan(0);
    }
    for (const option of formats) {
      for (const category of Object.keys(option.effects))
        expect(ids.has(category as never)).toBe(true);
    }
  });

  it('reports unknown dependencies and cycles instead of scheduling them', () => {
    expect(topoOrder([{ id: 'a', dependsOn: ['ghost'] }])).toEqual({
      ok: false,
      error: { kind: 'unknownDependency', taskId: 'a', dependsOn: 'ghost' },
    });
    const cycle = topoOrder([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: [] },
    ]);
    expect(cycle).toEqual({ ok: false, error: { kind: 'cycle', taskIds: ['a', 'b'] } });
    const broken = { ...TASKS[0]!, dependsOn: ['ghost'] };
    expect(schedule({ tasks: [broken], states: {}, eventDate: EVENT, today: TODAY })).toEqual({
      tasks: [],
      criticalPath: [],
      lateCount: 0,
    });
  });
});

describe('Timeline: Riya & Arjun sample, 110 days out', () => {
  const base = plan();

  it('starts nothing before today or before its dependencies finish', () => {
    for (const t of base.tasks) {
      expect(t.start >= TODAY).toBe(true);
      for (const dep of t.dependsOn) expect(t.start >= task(base, dep).finish).toBe(true);
    }
  });

  it('has every task on time, with the muhurat and venue on the critical path', () => {
    expect(base.lateCount).toBe(0);
    expect(base.tasks.every((t) => t.status === 'ok')).toBe(true);
    expect(task(base, 'muhurat').slack).toBe(5);
    expect(task(base, 'venue').slack).toBe(6);
    expect(task(base, 'venue').due).toBe(addDays(EVENT, -90));
    expect(base.criticalPath).toEqual(['muhurat']);
    expect(compressionTips(base)).toEqual([]);
  });
});

describe('Timeline: Change Test — "event 2 weeks earlier"', () => {
  const earlier = plan({}, EARLIER);

  it('makes the muhurat and venue late and the caterer tight', () => {
    expect(task(earlier, 'muhurat')).toMatchObject({ status: 'late', slack: -9 });
    expect(task(earlier, 'venue')).toMatchObject({ status: 'late', slack: -8 });
    expect(task(earlier, 'caterer')).toMatchObject({ status: 'tight', slack: 2 });
    expect(earlier.lateCount).toBe(2);
  });

  it('suggests compressions, biggest saving first, and says which ones clear the delay', () => {
    const tips = compressionTips(earlier);
    expect(tips.map((t) => [t.taskId, t.savingDays, t.clears])).toEqual([
      ['venue', 9, true],
      ['muhurat', 3, false],
    ]);
    expect(tips.every((t) => t.text.length > 0)).toBe(true);
  });

  it('applying the venue compression clears its lateness', () => {
    const compressed = plan({ venue: state({ compressed: true }) }, EARLIER);
    const venue = task(compressed, 'venue');
    expect(venue.durationDays).toBe(5);
    expect(venue.savingDays).toBe(0);
    expect(venue.status).not.toBe('late');
  });

  it('falls back to a generic tip when a task has none', () => {
    const bare = TASKS.map(({ tip: _tip, ...rest }) => rest);
    const s = schedule({ tasks: bare, states: {}, eventDate: EARLIER, today: TODAY });
    expect(compressionTips(s)[0]?.text).toBe('Shorten this step to 5 days.');
  });
});

describe('Timeline: delays and completed tasks', () => {
  it('a delay moves the task and its successors, never its predecessors', () => {
    const delayed = plan({ caterer: state({ delayDays: 10 }) });
    const base = plan();
    expect(task(delayed, 'venue')).toEqual(task(base, 'venue'));
    expect(task(delayed, 'caterer').start).toBe(task(base, 'caterer').start);
    expect(toDayNumber(task(delayed, 'caterer').finish)).toBe(
      toDayNumber(task(base, 'caterer').finish) + 10,
    );
    expect(task(delayed, 'headcount').start > task(base, 'headcount').start).toBe(true);
  });

  it('holds for any task and any delay (property)', () => {
    const ids = TASKS.map((t) => t.id);
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.integer({ min: 1, max: 120 }), (id, days) => {
        const base = plan();
        const delayed = plan({ [id]: state({ delayDays: days }) });
        const downstream = descendants(TASKS, id);
        for (const t of delayed.tasks) {
          for (const dep of t.dependsOn) expect(t.start >= task(delayed, dep).finish).toBe(true);
          if (t.id !== id && !downstream.has(t.id)) {
            expect([t.start, t.finish]).toEqual([task(base, t.id).start, task(base, t.id).finish]);
          }
        }
      }),
    );
  });

  it('a completed task takes no time and leaves the critical path', () => {
    const done = plan({ muhurat: state({ done: true, doneOn: TODAY }) });
    const muhurat = task(done, 'muhurat');
    expect(muhurat).toMatchObject({
      status: 'done',
      durationDays: 0,
      critical: false,
      savingDays: 0,
    });
    expect(done.criticalPath).not.toContain('muhurat');
    expect(done.criticalPath).toContain('venue');
  });

  it('marks nothing critical when every task is done', () => {
    const states = Object.fromEntries(TASKS.map((t) => [t.id, state({ done: true })]));
    const allDone = plan(states);
    expect(allDone.criticalPath).toEqual([]);
    expect(allDone.tasks.every((t) => t.status === 'done')).toBe(true);
  });
});
