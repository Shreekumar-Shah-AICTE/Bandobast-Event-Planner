import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/limits.js';
import type { CategoryId, Payment } from '../../shared/schemas.js';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import { addDays } from './dates.js';
import { rupees } from './money.js';
import { addPayment, paymentState, removePayment, setPaid, summarisePayments } from './payments.js';
import { buildPlan, initialInput } from './plan.js';

const input = initialInput(weddingProfile());
/** A ₹`amount` advance due `due` days from today. */
const pay = (id: string, category: CategoryId, amount: number, due: number): Payment => ({
  id,
  category,
  label: 'Advance',
  amountPaise: rupees(amount),
  dueOn: addDays(TODAY, due),
});
const draft = { category: 'decor', label: 'Advance', amount: '1.2 lakh', dueOn: TODAY } as const;

describe('payments', () => {
  it('totals paid, due and overdue money per vendor and for the event', () => {
    const payments = [
      pay('p1', 'catering', 50_000, 10),
      pay('p2', 'catering', 20_000, -1),
      { ...pay('p3', 'venue', 100_000, -30), paidOn: addDays(TODAY, -30) },
    ];
    const booked = {
      ...input,
      overrides: { catering: { kind: 'booked', amountPaise: rupees(60_000) } },
    } as const;
    const summary = summarisePayments(payments, buildPlan(booked, TODAY).budget.lines, TODAY);
    expect(summary).toMatchObject({
      paid: rupees(100_000),
      due: rupees(70_000),
      overdue: rupees(20_000),
    });
    expect(summary.next?.id).toBe('p2');
    expect(summary.vendors.get('catering')).toMatchObject({
      unscheduled: 0,
      excess: rupees(10_000),
    });
    expect(summary.vendors.get('venue')).toMatchObject({
      paid: rupees(100_000),
      unscheduled: null,
      excess: 0,
    });
    expect(payments.map((payment) => paymentState(payment, TODAY))).toEqual([
      'due',
      'overdue',
      'paid',
    ]);
  });

  it('adds a checked payment, marks it paid and unpaid, and removes it', () => {
    const added = addPayment(
      { ...input, payments: [pay('p7', 'venue', 1000, 0)] },
      { ...draft, label: ' ', amount: '50000' },
    );
    if (!added.ok) throw new Error(added.error);
    expect(added.value.payments[1]).toEqual({
      id: 'p8',
      category: 'decor',
      label: 'Payment',
      amountPaise: rupees(50_000),
      dueOn: TODAY,
    });
    const paid = setPaid(added.value, 'p8', TODAY);
    expect(paid.payments[1]?.paidOn).toBe(TODAY);
    expect(setPaid(paid, 'p8', null).payments[1]).not.toHaveProperty('paidOn');
    expect(removePayment(paid, 'p8').payments.map((payment) => payment.id)).toEqual(['p7']);
  });

  it.each([
    [{ amount: 'soon' }, /Enter the amount/],
    [{ amount: '0' }, /Enter the amount/],
    [{ dueOn: '2026-02-30' }, /Choose the date/],
    [{ amount: '₹20 crore' }, /more than a plan can hold/],
  ])('refuses %o', (change, message) => {
    const result = addPayment(input, { ...draft, ...change });
    expect(result.ok ? 'added' : result.error).toMatch(message);
  });

  it('caps the number of payments', () => {
    const payments = Array.from({ length: LIMITS.maxPayments }, (_, i) =>
      pay(`p${String(i + 1)}`, 'venue', 1000, 0),
    );
    expect(addPayment({ ...input, payments }, draft)).toMatchObject({ ok: false });
    expect(addPayment(input, draft)).toMatchObject({
      ok: true,
      value: { payments: [{ amountPaise: rupees(120_000) }] },
    });
  });
});
