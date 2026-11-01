/** The plan store for the app: reducer + saving to this browser, debounced. */
import { useEffect, useReducer, useState } from 'react';
import { loadPlan, savePlan, type Loaded } from './persistence.js';
import { planReducer, type PlanAction, type PlanState } from './planState.js';

/** Saves wait this long after the last change, so quick edits write once. */
export const SAVE_DELAY_MS = 300;

/**
 * What `usePlan` returns: the state, its dispatch, any problem with the saved plan, and whether the
 * last save worked.
 */
export interface PlanStore {
  readonly state: PlanState;
  readonly dispatch: (action: PlanAction) => void;
  readonly problem: Loaded['problem'];
  /** False when the last save failed. */
  readonly saved: boolean;
}

/**
 * Loads the saved plan once, keeps the versions in a reducer, and saves after changes (debounced,
 * and at once when the tab is hidden).
 */
export function usePlan(storage: Storage): PlanStore {
  const [loaded] = useState(() => loadPlan(storage));
  const [state, dispatch] = useReducer(planReducer, loaded.state);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const save = () => {
      setSaved(savePlan(storage, state));
    };
    // Closing or hiding the tab saves at once, so the last change is never lost.
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const timer = setTimeout(save, SAVE_DELAY_MS);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [storage, state]);
  return { state, dispatch, problem: loaded.problem, saved };
}
