/**
 * Vendor payments: advances and instalments with due dates. Totals for paid,
 * due and overdue money, per vendor and for the event, plus how much of a
 * booked amount has no payment yet. Pure; money is integer paise.
 */
import { LIMITS } from '../../shared/limits.js';
import {
  PaymentSchema,
  type CategoryId,
  type Payment,
  type PlanInput,
} from '../../shared/schemas.js';
import type { BudgetLine } from './budget.js';
import { isIsoDate, type IsoDate } from './dates.js';
import { parseMoney, sumPaise, type Paise } from './money.js';
import { err, ok, type Result } from './result.js';

export type PaymentState = 'paid' | 'overdue' | 'due';

/** Paid once `paidOn` is set; otherwise overdue after its due date. ISO dates sort as text. O(1). */
export const paymentState = (payment: Payment, today: IsoDate): PaymentState =>
  payment.paidOn !== undefined ? 'paid' : payment.dueOn < today ? 'overdue' : 'due';

export interface VendorPayments {
  /** Soonest due first. */
  readonly payments: readonly Payment[];
  readonly paid: Paise;
  /** Not yet paid, including overdue. */
  readonly due: Paise;
  readonly overdue: Paise;
  /** Booked amount with no payment against it yet; null when the line is not booked. */
  readonly unscheduled: Paise | null;
  /** How far the payments go past the booked amount; 0 when they fit. */
  readonly excess: Paise;
}

export interface PaymentSummary {
  readonly paid: Paise;
  readonly due: Paise;
  readonly overdue: Paise;
  /** The unpaid payment due soonest (overdue ones come first), or null. */
  readonly next: Payment | null;
  readonly vendors: ReadonlyMap<CategoryId, VendorPayments>;
}

const total = (payments: readonly Payment[]): Paise =>
  sumPaise(payments.map((payment) => payment.amountPaise));

function forVendor(payments: readonly Payment[], booked: Paise | null, today: IsoDate) {
  const unpaid = payments.filter((payment) => payment.paidOn === undefined);
  const paid = total(payments) - total(unpaid);
  const due = total(unpaid);
  const covered = paid + due;
  return {
    payments,
    paid,
    due,
    overdue: total(unpaid.filter((payment) => payment.dueOn < today)),
    unscheduled: booked === null ? null : Math.max(0, booked - covered),
    excess: booked === null ? 0 : Math.max(0, covered - booked),
  } satisfies VendorPayments;
}

/** Totals per vendor and for the event; `lines` give the booked amounts. O(p log p + c). */
export function summarisePayments(
  payments: readonly Payment[],
  lines: readonly BudgetLine[],
  today: IsoDate,
): PaymentSummary {
  const sorted = payments.toSorted((a, b) => a.dueOn.localeCompare(b.dueOn));
  const vendors = new Map<CategoryId, VendorPayments>();
  for (const line of lines) {
    const own = sorted.filter((payment) => payment.category === line.category);
    const booked = line.provenance === 'booked' ? line.planned : null;
    vendors.set(line.category, forVendor(own, booked, today));
  }
  const all = forVendor(sorted, null, today);
  const next = sorted.find((payment) => payment.paidOn === undefined) ?? null;
  return { paid: all.paid, due: all.due, overdue: all.overdue, next, vendors };
}

export interface PaymentDraft {
  readonly category: CategoryId;
  readonly label: string;
  /** As typed: "50,000", "₹50k" or "1.2 lakh". */
  readonly amount: string;
  readonly dueOn: string;
}

/** Next free id ("p1", "p2", …). O(p). */
const nextPaymentId = (payments: readonly Payment[]): string => {
  const used = payments.map((payment) => Number(payment.id.slice(1))).filter(Number.isInteger);
  return `p${String(Math.max(0, ...used) + 1)}`;
};

/** Adds a payment after checking the amount and date; bare numbers count as rupees. O(p). */
export function addPayment(input: PlanInput, draft: PaymentDraft): Result<PlanInput, string> {
  if (input.payments.length >= LIMITS.maxPayments) {
    return err(`A plan can hold ${String(LIMITS.maxPayments)} payments. Remove a paid one first.`);
  }
  const amountPaise = parseMoney(draft.amount) ?? parseMoney(`₹${draft.amount}`);
  if (amountPaise === null || amountPaise === 0) {
    return err('Enter the amount, for example 50,000 or 1.2 lakh.');
  }
  if (!isIsoDate(draft.dueOn)) return err('Choose the date this payment is due.');
  const payment = PaymentSchema.safeParse({
    id: nextPaymentId(input.payments),
    category: draft.category,
    label: draft.label.trim() === '' ? 'Payment' : draft.label,
    amountPaise,
    dueOn: draft.dueOn,
  });
  if (!payment.success) return err('That is more than a plan can hold (₹10 crore).');
  return ok({ ...input, payments: [...input.payments, payment.data] });
}

/** Marks a payment paid on `paidOn`, or unpaid again with null. O(p). */
export function setPaid(input: PlanInput, id: string, paidOn: IsoDate | null): PlanInput {
  const payments = input.payments.map((payment) => {
    if (payment.id !== id) return payment;
    const { paidOn: _old, ...rest } = payment;
    return paidOn === null ? rest : { ...rest, paidOn };
  });
  return { ...input, payments };
}

/** Removes a payment. O(p). */
export const removePayment = (input: PlanInput, id: string): PlanInput => ({
  ...input,
  payments: input.payments.filter((payment) => payment.id !== id),
});
