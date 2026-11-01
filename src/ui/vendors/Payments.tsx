/** A vendor's advances and instalments: add one, mark it paid, or remove it. */
import { useId, useState, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import type { CategoryId, Payment } from '../../../shared/schemas.js';
import { formatDate } from '../../domain/dates.js';
import { formatInr } from '../../domain/money.js';
import {
  addPayment,
  paymentState,
  removePayment,
  setPaid,
  type PaymentState,
  type VendorPayments,
} from '../../domain/payments.js';
import type { PlanControls } from '../dashboard/controls.js';

/** Words for each payment state. */
export const PAYMENT_STATE_LABELS: Readonly<Record<PaymentState, string>> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
};

/** "₹50,000 paid, ₹1,00,000 to pay", either part alone, or "none yet". O(1). */
export function paymentTotals({ paid, due }: Pick<VendorPayments, 'paid' | 'due'>): string {
  const parts = [
    paid > 0 ? `${formatInr(paid)} paid` : '',
    due > 0 ? `${formatInr(due)} to pay` : '',
  ];
  return parts.filter((part) => part !== '').join(', ') || 'none yet';
}

interface VendorProps {
  readonly category: CategoryId;
  readonly vendor: string;
  readonly controls: PlanControls;
}

/**
 * A vendor's advances and instalments, with what is paid, due and overdue, and a form to add one.
 */
export function VendorPaymentsBlock({ category, vendor, controls }: VendorProps) {
  const summary = controls.plan.payments.vendors.get(category);
  if (summary === undefined) return null;
  return (
    <details className="payments">
      <summary>{`Payments: ${paymentTotals(summary)}`}</summary>
      {summary.payments.length > 0 && (
        <ul className="compact-list">
          {summary.payments.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} vendor={vendor} controls={controls} />
          ))}
        </ul>
      )}
      {summary.excess > 0 && (
        <p className="warning-text">{`These payments are ${formatInr(summary.excess)} more than the booked amount.`}</p>
      )}
      {summary.unscheduled !== null && summary.unscheduled > 0 && (
        <p className="hint">{`${formatInr(summary.unscheduled)} of the booked amount has no payment yet.`}</p>
      )}
      <PaymentForm category={category} vendor={vendor} controls={controls} />
    </details>
  );
}

interface RowProps {
  readonly payment: Payment;
  readonly vendor: string;
  readonly controls: PlanControls;
}

function PaymentRow({ payment, vendor, controls }: RowProps) {
  const { input } = controls.plan;
  const state = paymentState(payment, controls.today);
  const when =
    payment.paidOn === undefined
      ? `due ${formatDate(payment.dueOn)}`
      : `paid ${formatDate(payment.paidOn)}`;
  const which = <span className="visually-hidden">{`: ${payment.label}, ${vendor}`}</span>;
  return (
    <li>
      {`${payment.label}, ${formatInr(payment.amountPaise)} `}
      <span className="hint">{when}</span>{' '}
      <span className={`badge badge-pay-${state}`}>{PAYMENT_STATE_LABELS[state]}</span>{' '}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          controls.edit(setPaid(input, payment.id, state === 'paid' ? null : controls.today));
        }}
      >
        {state === 'paid' ? 'Mark unpaid' : 'Mark paid'}
        {which}
      </button>{' '}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          controls.edit(removePayment(input, payment.id));
        }}
      >
        Remove
        {which}
      </button>
    </li>
  );
}

function PaymentForm({ category, vendor, controls }: VendorProps) {
  const { input } = controls.plan;
  const [draft, setDraft] = useState({ label: 'Advance', amount: '', dueOn: controls.today });
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const result = addPayment(input, { category, ...draft });
    setProblem(result.ok ? null : result.error);
    if (!result.ok) return;
    controls.edit(result.value);
    setDraft({ ...draft, amount: '' });
  };
  const field = (name: keyof typeof draft) => ({
    id: `${id}-${name}`,
    value: draft[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraft({ ...draft, [name]: event.target.value });
    },
  });
  return (
    <form
      className="inline-form payment-form"
      onSubmit={submit}
      aria-label={`Add a payment for ${vendor}`}
    >
      <label htmlFor={`${id}-label`}>What for</label>
      <input {...field('label')} maxLength={LIMITS.maxTitleLength} />
      <label htmlFor={`${id}-amount`}>Amount</label>
      <input {...field('amount')} inputMode="decimal" placeholder="50,000" />
      <label htmlFor={`${id}-dueOn`}>Due on</label>
      <input {...field('dueOn')} type="date" />
      <button type="submit">Add payment</button>
      {problem !== null && (
        <p className="error-text" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}
