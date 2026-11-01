/** The plan on screen: header, the change box, the impact report and the tabs. */
import { useMemo } from 'react';
import type { PlanVersion } from '../../../shared/schemas.js';
import type { IsoDate } from '../../domain/dates.js';
import { buildPlan } from '../../domain/plan.js';
import type { PlanAction, PlanState } from '../../state/planState.js';
import { ChangeBox } from './ChangeBox.js';
import type { PlanControls } from './controls.js';
import { ImpactReport } from './Impact.js';
import { PlanHeader } from './PlanHeader.js';
import { PlanTabs } from './PlanTabs.js';

interface DashboardProps {
  readonly state: PlanState;
  readonly version: PlanVersion;
  readonly dispatch: (action: PlanAction) => void;
  readonly today: IsoDate;
}

/**
 * The plan screen: builds the plan for the version on screen and shows the header, the change box,
 * the report and the tabs.
 */
export function Dashboard({ state, version, dispatch, today }: DashboardProps) {
  const plan = useMemo(() => buildPlan(version.input, today), [version.input, today]);
  const controls = useMemo<PlanControls>(
    () => ({
      plan,
      today,
      commit: (input, label) => {
        dispatch({ type: 'commit', input, label, today, report: false });
      },
      edit: (input) => {
        dispatch({ type: 'edit', input });
      },
    }),
    [plan, today, dispatch],
  );
  const { report } = state;
  const before = state.versions.find((entry) => entry.version === report?.from);
  return (
    <div className="dashboard">
      <PlanHeader plan={plan} today={today} />
      <ChangeBox
        controls={controls}
        onApply={(input, label, changes) => {
          dispatch({ type: 'commit', input, label, today, changes, report: true });
        }}
      />
      {report !== null && before !== undefined && (
        <ImpactReport
          key={`${String(report.from)}-${String(report.to)}`}
          before={before}
          label={version.label}
          controls={controls}
          onUndo={() => {
            dispatch({ type: 'restore', version: before.version, today });
          }}
          onClose={() => {
            dispatch({ type: 'dismissReport' });
          }}
        />
      )}
      <PlanTabs controls={controls} state={state} dispatch={dispatch} />
    </div>
  );
}
