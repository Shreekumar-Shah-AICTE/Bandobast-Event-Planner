/**
 * Impact Report: after a change, what moved — profile, budget lines, reserve,
 * tasks that became late, quote totals — with ways to recover, and Undo.
 */
import { useMemo } from 'react';
import type { PlanVersion } from '../../../shared/schemas.js';
import { diffPlans } from '../../domain/diff.js';
import { buildPlan } from '../../domain/plan.js';
import { Scenarios } from '../budget/Scenarios.js';
import { useFocusOnMount } from '../common/hooks.js';
import { compress } from '../timeline/taskEdits.js';
import type { PlanControls } from './controls.js';
import { LineChanges, ProfileChanges, QuoteChanges, TaskChanges } from './ImpactParts.js';

interface ImpactProps {
  readonly before: PlanVersion;
  readonly label: string;
  readonly controls: PlanControls;
  readonly onUndo: () => void;
  readonly onClose: () => void;
}

/**
 * The What changed report for the latest change, with ways to rebalance and Undo. It takes focus
 * when it opens.
 */
export function ImpactReport({ before, label, controls, onUndo, onClose }: ImpactProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const { plan, today } = controls;
  const previous = useMemo(() => buildPlan(before.input, today), [before.input, today]);
  const report = useMemo(() => diffPlans(previous, plan), [previous, plan]);
  const short = plan.budget.feasibility === 'tight' || plan.budget.feasibility === 'over';
  return (
    <section className="panel impact" aria-labelledby="impact-title">
      <h2 id="impact-title" ref={heading} tabIndex={-1}>
        What changed
      </h2>
      <p className="impact-label">{label}</p>
      {report.isEmpty ? (
        <p>Nothing in the plan changed.</p>
      ) : (
        <>
          <ProfileChanges report={report} />
          <LineChanges report={report} />
          <TaskChanges
            report={report}
            tips={plan.tips}
            onShorten={(taskId) => {
              controls.edit(compress(plan.input, taskId));
            }}
          />
          <QuoteChanges report={report} />
        </>
      )}
      {short && <ImpactOptions controls={controls} />}
      <div className="actions">
        <button type="button" onClick={onUndo}>
          Undo this change
        </button>
        <button type="button" onClick={onClose}>
          Close the report
        </button>
      </div>
    </section>
  );
}

/** Rebalance options inside the report; choosing one updates this version in place. */
function ImpactOptions({ controls }: { readonly controls: PlanControls }) {
  const { plan } = controls;
  return (
    <section aria-labelledby="impact-options">
      <h3 id="impact-options">Ways to rebalance</h3>
      <Scenarios
        scenarios={plan.scenarios}
        settings={plan.input.settings}
        onUse={(scenario) => {
          controls.edit({ ...plan.input, settings: scenario.settings });
        }}
      />
    </section>
  );
}
