/**
 * The saved plan: every version's inputs (never derived numbers), which version
 * is current, and which change the impact report describes. Pure reducer.
 */
import type { Change, EventProfile, PlanInput, PlanVersion } from '../../shared/schemas.js';
import type { IsoDate } from '../domain/dates.js';
import { addVersion, firstVersion } from '../domain/plan.js';
import type { Persisted } from '../domain/storage.js';

export interface PlanState {
  readonly versions: readonly PlanVersion[];
  /** Version number on screen. */
  readonly current: number;
  /** The last change, for the impact report: from version → to version. */
  readonly report: { readonly from: number; readonly to: number } | null;
}

export const EMPTY_STATE: PlanState = { versions: [], current: 0, report: null };

export type PlanAction =
  | { readonly type: 'start'; readonly profile: EventProfile; readonly today: IsoDate }
  | {
      readonly type: 'commit';
      readonly input: PlanInput;
      readonly label: string;
      readonly today: IsoDate;
      readonly changes?: readonly Change[];
      /** Show an impact report for this commit. */
      readonly report: boolean;
    }
  /** Updates the version on screen in place (ticks, statuses, report actions). */
  | { readonly type: 'edit'; readonly input: PlanInput }
  | { readonly type: 'restore'; readonly version: number; readonly today: IsoDate }
  | { readonly type: 'dismissReport' }
  /** Replaces everything with a plan file that passed the same checks as a saved plan. */
  | { readonly type: 'load'; readonly saved: Persisted }
  | { readonly type: 'reset' };

/** The version on screen, or null before the first plan. O(v). */
export const currentVersion = (state: PlanState): PlanVersion | null =>
  state.versions.find((entry) => entry.version === state.current) ?? null;

function commit(state: PlanState, action: Extract<PlanAction, { type: 'commit' }>): PlanState {
  const versions = addVersion(state.versions, action);
  const latest = versions.at(-1)?.version ?? state.current;
  return {
    versions,
    current: latest,
    report: action.report ? { from: state.current, to: latest } : null,
  };
}

function restore(state: PlanState, action: Extract<PlanAction, { type: 'restore' }>): PlanState {
  const target = state.versions.find((entry) => entry.version === action.version);
  if (target === undefined) return state;
  const label = `Restored version ${String(action.version)}`;
  return commit(state, {
    type: 'commit',
    input: target.input,
    label,
    today: action.today,
    report: true,
  });
}

/** All plan changes go through here. O(v). */
export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'start':
      return { versions: [firstVersion(action.profile, action.today)], current: 1, report: null };
    case 'commit':
      return commit(state, action);
    case 'edit':
      return {
        ...state,
        versions: state.versions.map((entry) =>
          entry.version === state.current ? { ...entry, input: action.input } : entry,
        ),
      };
    case 'restore':
      return restore(state, action);
    case 'dismissReport':
      return { ...state, report: null };
    case 'load':
      return { versions: action.saved.versions, current: action.saved.current, report: null };
    case 'reset':
      return EMPTY_STATE;
  }
}
