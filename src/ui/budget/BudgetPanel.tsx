/** Budget tab: totals, every line with where its number came from, and rebalance options. */
import { describeCityPricing } from '../../domain/cityCost.js';
import { formatInr, sumPaise } from '../../domain/money.js';
import { plural } from '../common/format.js';
import { FeasibilityBadge } from '../common/Labels.js';
import type { PlanControls } from '../dashboard/controls.js';
import { gapText } from '../dashboard/PlanHeader.js';
import { BudgetBar } from './BudgetBar.js';
import { BudgetTable } from './BudgetTable.js';
import { Scenarios } from './Scenarios.js';

/** The Budget tab: the budget check, the bar, the line table and the ways to rebalance. */
export function BudgetPanel({ controls }: { readonly controls: PlanControls }) {
  const { plan } = controls;
  const { budget } = plan;
  return (
    <section aria-labelledby="budget-title">
      <h2 id="budget-title">Budget</h2>
      <dl className="facts">
        <div>
          <dt>Total budget</dt>
          <dd>{formatInr(budget.total)}</dd>
        </div>
        <div>
          <dt>In the lines below</dt>
          <dd>{formatInr(sumPaise(budget.lines.map((line) => line.planned)))}</dd>
        </div>
        <div>
          <dt>Reserve for surprises</dt>
          <dd>{`${formatInr(budget.contingency)} (${formatInr(budget.contingencyTarget)} recommended)`}</dd>
        </div>
        <div>
          <dt>Budget check</dt>
          <dd>
            <FeasibilityBadge feasibility={budget.feasibility} /> {gapText(budget.gap)}
          </dd>
        </div>
      </dl>
      <BudgetBar budget={budget} />
      <p className="hint">
        {`Typical costs are mid-range assumptions for ${plural(plan.input.profile.guests, 'guest')}, ${describeCityPricing(plan.input.profile.city)}. They are not quotes: replace them with your own number or a checked quote.`}
      </p>
      <BudgetTable controls={controls} />
      <section aria-labelledby="options-title">
        <h3 id="options-title">Ways to rebalance</h3>
        <Scenarios
          scenarios={plan.scenarios}
          settings={plan.input.settings}
          onUse={(scenario) => {
            controls.commit(
              { ...plan.input, settings: scenario.settings },
              `Rebalanced: ${scenario.label}`,
            );
          }}
        />
      </section>
    </section>
  );
}
