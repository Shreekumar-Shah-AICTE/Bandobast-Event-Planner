/** The plan store for the app: reducer + saving to this browser, debounced. */
import { useEffect, useReducer, useState } from 'react';
import { loadPlan, savePlan, type Loaded } from './persistence.js';
import { planReducer, type PlanAction, type PlanState } from './planState.js';

/** Saves wait this long after the last change, so typing does not write on every key. */
export const SAVE_DELAY_MS = 300;

export interface PlanStore {
  readonly state: PlanState;
  readonly dispatch: (action: PlanAction) => void;
  readonly problem: Loaded['problem'];
  /** False when the last save failed. */
  readonly saved: boolean;
}

export function usePlan(storage: Storage): PlanStore {
  const [loaded] = useState(() => loadPlan(storage));
  const [state, dispatch] = useReducer(planReducer, loaded.state);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSaved(savePlan(storage, state));
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [storage, state]);
  return { state, dispatch, problem: loaded.problem, saved };
}
