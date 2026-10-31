/**
 * Saves the plan in this browser only (localStorage). Nothing is sent to a
 * server. A damaged or newer save is kept aside, never silently overwritten.
 */
import { deserialise, serialise, STORAGE_KEY, type LoadError } from '../domain/storage.js';
import { EMPTY_STATE, type PlanState } from './planState.js';

export interface Loaded {
  readonly state: PlanState;
  /** Why an existing save could not be used, or null. */
  readonly problem: Exclude<LoadError, 'empty'> | null;
}

/** Key where an unreadable save is moved so a new plan cannot overwrite it. */
export const BACKUP_KEY = `${STORAGE_KEY}.unreadable`;

/** Moves an unreadable save to {@link BACKUP_KEY}; if even that fails, it stays where it is. */
function keepAside(storage: Storage, raw: string): void {
  try {
    storage.setItem(BACKUP_KEY, raw);
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to do: the original save is left untouched.
  }
}

/** Reads the saved plan. O(n) in the saved size. */
export function loadPlan(storage: Storage): Loaded {
  const raw = storage.getItem(STORAGE_KEY);
  const result = deserialise(raw);
  if (result.ok) {
    const { versions, current } = result.value;
    return { state: { versions, current, report: null }, problem: null };
  }
  if (result.error !== 'empty' && raw !== null) keepAside(storage, raw);
  return { state: EMPTY_STATE, problem: result.error === 'empty' ? null : result.error };
}

/** Writes the plan; returns false when the browser refuses (private mode, full disk). O(n). */
export function savePlan(storage: Storage, state: PlanState): boolean {
  try {
    if (state.versions.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, serialise(state.versions, state.current));
    return true;
  } catch {
    return false;
  }
}
