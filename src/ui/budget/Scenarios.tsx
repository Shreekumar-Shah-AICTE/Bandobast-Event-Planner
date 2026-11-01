/** Rebalance options when money is short: the effect of each, and how much it asks of you. */
import type { Settings } from '../../../shared/schemas.js';
import { explainOptions, type Reading } from '../../ai/readers.js';
import { formatInr } from '../../domain/money.js';
import type { PainLevel, Scenario } from '../../domain/scenarios.js';
import { useAsk } from '../common/hooks.js';
import { FeasibilityBadge, SourceNote } from '../common/Labels.js';

const PAIN_TEXT: Readonly<Record<PainLevel, string>> = {
  low: 'Asks little of you',
  medium: 'Asks a fair amount of you',
  high: 'Asks a lot of you',
};

interface ScenariosProps {
  readonly scenarios: readonly Scenario[];
  readonly settings: Settings;
  readonly onUse: (scenario: Scenario) => void;
}

/** A key that changes whenever the options or their amounts change. */
const optionsKey = (scenarios: readonly Scenario[]): string =>
  scenarios.map((s) => `${s.id}:${String(s.budget.contingency)}`).join('|');

/** The ranked ways to rebalance, each with what it changes and a button to use it. */
export function Scenarios({ scenarios, settings, onUse }: ScenariosProps) {
  if (scenarios.length === 0) {
    return <p>The budget covers typical costs and the reserve, so nothing needs rebalancing.</p>;
  }
  return (
    <div className="scenarios" data-strategy={settings.strategy}>
      <ul className="card-grid">
        {scenarios.map((scenario) => (
          <li key={scenario.id} className="card scenario">
            <h4>{scenario.label}</h4>
            <p>{scenario.description}</p>
            <p className="scenario-effect">
              After: <FeasibilityBadge feasibility={scenario.budget.feasibility} />
              {` Reserve ${formatInr(scenario.budget.contingency)}. ${PAIN_TEXT[scenario.painLevel]}.`}
            </p>
            <button
              type="button"
              onClick={() => {
                onUse(scenario);
              }}
            >
              Use this option<span className="visually-hidden">{`: ${scenario.label}`}</span>
            </button>
          </li>
        ))}
      </ul>
      <Explain key={optionsKey(scenarios)} scenarios={scenarios} />
    </div>
  );
}

function Explain({ scenarios }: { readonly scenarios: readonly Scenario[] }) {
  const ask = useAsk<Reading<string>>();
  return (
    <div className="explain">
      <button
        type="button"
        disabled={ask.busy}
        aria-busy={ask.busy}
        onClick={() => void ask.run((signal) => explainOptions(scenarios, signal))}
      >
        {ask.busy ? 'Writing…' : 'Compare these options in plain words'}
      </button>
      <div role="status" className="status-area">
        {ask.result !== null && (
          <>
            <p className="explain-text">{ask.result.value}</p>
            <SourceNote reading={ask.result} />
          </>
        )}
      </div>
    </div>
  );
}
