import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/dates.js';
import { rupees } from '../../domain/money.js';
import { TODAY, weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

describe('vendors tab', () => {
  it('moves a vendor one step at a time and counts bookings', async () => {
    const { user } = renderPlan(weddingProfile());
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.getByText(/^0 of \d+ booked/)).toBeInTheDocument();
    const status = screen.getByRole('combobox', { name: 'Status of Caterer' });
    expect(within(status).queryByRole('option', { name: 'Booked' })).not.toBeInTheDocument();
    await user.selectOptions(status, 'contacted');
    expect(status).toHaveValue('contacted');
    await user.selectOptions(status, 'quoted');
    await user.selectOptions(status, 'booked');
    expect(screen.getByText(/^1 of \d+ booked/)).toBeInTheDocument();
  });

  it('lists questions to ask and links a Maps search that opens in a new tab', async () => {
    const { user } = renderPlan(weddingProfile());
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.getAllByText(/^Questions to ask \(\d+\)$/).length).toBeGreaterThan(3);
    const link = screen.getAllByRole('link', {
      name: /in Pune on Google Maps \(opens in a new tab\)$/,
    })[0];
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link?.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
  });

  it('tracks advances against a booking and totals them on the overview', async () => {
    const { user } = renderPlan(weddingProfile(), {
      overrides: { catering: { kind: 'booked', amountPaise: rupees(300_000) } },
    });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    const card = screen.getByRole('heading', { name: 'Caterer' }).closest('li')!;
    await user.click(within(card).getByText('Payments: none yet'));
    const form = within(card).getByRole('form', { name: 'Add a payment for Caterer' });
    const add = within(form).getByRole('button', { name: 'Add payment' });
    await user.click(add);
    expect(within(form).getByRole('alert')).toHaveTextContent('Enter the amount');
    await user.type(within(form).getByLabelText('Amount'), '1 lakh');
    await user.click(add);
    expect(within(card).getByText('Payments: ₹1,00,000 to pay')).toBeInTheDocument();
    expect(
      within(card).getByText('₹2,00,000 of the booked amount has no payment yet.'),
    ).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Mark paid: Advance, Caterer' }));
    expect(within(card).getByText('Paid')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Payments: ₹1,00,000 paid.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(screen.getByText('Payments: ₹1,00,000 paid'));
    await user.click(screen.getByRole('button', { name: 'Mark unpaid: Advance, Caterer' }));
    await user.click(screen.getByRole('button', { name: 'Remove: Advance, Caterer' }));
    expect(screen.getAllByText('Payments: none yet').length).toBeGreaterThan(3);
  });

  it('shows overdue and next payments on the overview', () => {
    const due = { id: 'p1', label: 'Deposit', amountPaise: rupees(50_000) };
    renderPlan(weddingProfile(), {
      payments: [
        { ...due, category: 'venue', dueOn: addDays(TODAY, -2) },
        { ...due, id: 'p2', category: 'decor', dueOn: addDays(TODAY, 9) },
      ],
    });
    expect(screen.getByText('₹50,000 is overdue.')).toBeInTheDocument();
    expect(screen.getByText(/^Next: Deposit to Venue, ₹50,000, due /)).toBeInTheDocument();
  });
});
