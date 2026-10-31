/** Budget lines with their source; any line can take your own number or go back to the estimate. */
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import type { BudgetLine } from '../../domain/budget.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { formatInr, parseMoney, rupees, type Paise } from '../../domain/money.js';
import { useFocusOnMount } from '../common/hooks.js';
import { ProvenanceBadge } from '../common/Labels.js';
import type { PlanControls } from '../dashboard/controls.js';
import { withEstimate, withUserAmount } from './budgetEdits.js';

export function BudgetTable({ controls }: { readonly controls: PlanControls }) {
  return (
    <table className="data-table budget-table">
      <caption>Where the money goes</caption>
      <thead>
        <tr>
          <th scope="col">Line</th>
          <th scope="col">In the plan</th>
          <th scope="col">Typical</th>
          <th scope="col">Source</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {controls.plan.budget.lines.map((line) => (
          <BudgetRow key={line.category} line={line} controls={controls} />
        ))}
      </tbody>
    </table>
  );
}

function BudgetRow({
  line,
  controls,
}: {
  readonly line: BudgetLine;
  readonly controls: PlanControls;
}) {
  const [editing, setEditing] = useState(false);
  const [refocus, setRefocus] = useState(false);
  const { input } = controls.plan;
  const label = CATEGORIES[line.category].label;
  const stop = () => {
    setEditing(false);
    setRefocus(true);
  };
  const save = (amountPaise: Paise) => {
    stop();
    const next = withUserAmount(input, line.category, amountPaise);
    controls.commit(next, `${label}: your number, ${formatInr(amountPaise)}`);
  };
  const clear = () => {
    controls.commit(withEstimate(input, line.category), `${label}: back to the estimate`);
  };
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{formatInr(line.planned)}</td>
      <td className="num">{formatInr(line.typical)}</td>
      <td>
        <ProvenanceBadge provenance={line.provenance} />
      </td>
      <td className="row-actions">
        {editing ? (
          <AmountForm label={label} initial={line.planned} onSave={save} onCancel={stop} />
        ) : (
          <RowActions
            label={label}
            estimate={line.provenance === 'estimate'}
            focus={refocus}
            onEdit={() => {
              setEditing(true);
            }}
            onClear={clear}
          />
        )}
      </td>
    </tr>
  );
}

interface RowActionsProps {
  readonly label: string;
  readonly estimate: boolean;
  /** Take focus when shown (after editing ends). */
  readonly focus: boolean;
  readonly onEdit: () => void;
  readonly onClear: () => void;
}

function RowActions({ label, estimate, focus, onEdit, onClear }: RowActionsProps) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) button.current?.focus();
  }, [focus]);
  return (
    <>
      <button ref={button} type="button" onClick={onEdit}>
        Set my number <span className="visually-hidden">for {label}</span>
      </button>
      {!estimate && (
        <button
          type="button"
          onClick={() => {
            onClear();
            button.current?.focus();
          }}
        >
          Use the estimate <span className="visually-hidden">for {label}</span>
        </button>
      )}
    </>
  );
}

interface AmountFormProps {
  readonly label: string;
  readonly initial: Paise;
  readonly onSave: (amount: Paise) => void;
  readonly onCancel: () => void;
}

function AmountForm({ label, initial, onSave, onCancel }: AmountFormProps) {
  const [text, setText] = useState(formatInr(initial));
  const [error, setError] = useState(false);
  const field = useFocusOnMount<HTMLInputElement>();
  const id = useId();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const amount = parseMoney(text);
    if (amount === null || amount > rupees(LIMITS.maxBudgetRupees)) setError(true);
    else onSave(amount);
  };
  return (
    <form className="inline-form" onSubmit={submit}>
      <label htmlFor={id}>{`Your amount for ${label}`}</label>
      <input
        id={id}
        ref={field}
        value={text}
        aria-invalid={error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {error && (
        <p id={`${id}-error`} className="error-text">
          Enter an amount, for example 4 lakh or ₹4,00,000.
        </p>
      )}
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
