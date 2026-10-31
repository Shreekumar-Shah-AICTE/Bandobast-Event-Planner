import { describe, expect, it } from 'vitest';
import { weddingProfile, TODAY } from '../test/fixtures.js';
import { currentVersion, EMPTY_STATE, planReducer, type PlanState } from './planState.js';

const start = (): PlanState =>
  planReducer(EMPTY_STATE, { type: 'start', profile: weddingProfile(), today: TODAY });

const withGuests = (state: PlanState, guests: number) => {
  const version = currentVersion(state);
  if (version === null) throw new Error('no plan');
  return { ...version.input, profile: { ...version.input.profile, guests } };
};

describe('planReducer', () => {
  it('starts a plan at version 1 with no report', () => {
    const state = start();
    expect(state.current).toBe(1);
    expect(state.report).toBeNull();
    expect(currentVersion(state)?.label).toBe('First plan');
  });

  it('commits a new version and reports it when asked', () => {
    const state = planReducer(start(), {
      type: 'commit',
      input: withGuests(start(), 250),
      label: 'Change: 50 more guests',
      today: TODAY,
      changes: [{ kind: 'guests', mode: 'add', value: 50, evidence: '50 more guests' }],
      report: true,
    });
    expect(state.current).toBe(2);
    expect(state.report).toEqual({ from: 1, to: 2 });
    expect(currentVersion(state)?.changes).toHaveLength(1);
  });

  it('a commit without a report clears the open report', () => {
    const reported = planReducer(start(), {
      type: 'commit',
      input: withGuests(start(), 250),
      label: 'a',
      today: TODAY,
      report: true,
    });
    const next = planReducer(reported, {
      type: 'commit',
      input: withGuests(reported, 260),
      label: 'b',
      today: TODAY,
      report: false,
    });
    expect(next.report).toBeNull();
    expect(next.versions).toHaveLength(3);
  });

  it('edits the version on screen in place and keeps the report', () => {
    const reported = planReducer(start(), {
      type: 'commit',
      input: withGuests(start(), 250),
      label: 'a',
      today: TODAY,
      report: true,
    });
    const edited = planReducer(reported, { type: 'edit', input: withGuests(reported, 240) });
    expect(edited.versions).toHaveLength(2);
    expect(currentVersion(edited)?.input.profile.guests).toBe(240);
    expect(edited.versions[0]?.input.profile.guests).toBe(200);
    expect(edited.report).toEqual(reported.report);
  });

  it('restores an old version as a new version, with a report', () => {
    const changed = planReducer(start(), {
      type: 'commit',
      input: withGuests(start(), 250),
      label: 'a',
      today: TODAY,
      report: false,
    });
    const restored = planReducer(changed, { type: 'restore', version: 1, today: TODAY });
    expect(restored.current).toBe(3);
    expect(currentVersion(restored)?.label).toBe('Restored version 1');
    expect(currentVersion(restored)?.input.profile.guests).toBe(200);
    expect(restored.report).toEqual({ from: 2, to: 3 });
  });

  it('ignores a restore of a version that does not exist', () => {
    const state = start();
    expect(planReducer(state, { type: 'restore', version: 9, today: TODAY })).toBe(state);
  });

  it('dismisses the report, resets to empty, and loads a plan file', () => {
    const reported = planReducer(start(), {
      type: 'commit',
      input: withGuests(start(), 250),
      label: 'a',
      today: TODAY,
      report: true,
    });
    expect(planReducer(reported, { type: 'dismissReport' }).report).toBeNull();
    const reset = planReducer(reported, { type: 'reset' });
    expect(reset).toEqual(EMPTY_STATE);
    expect(currentVersion(reset)).toBeNull();
    const saved = { schemaVersion: 1 as const, versions: [...start().versions], current: 1 };
    expect(planReducer(reported, { type: 'load', saved })).toEqual({ ...start(), report: null });
  });
});
