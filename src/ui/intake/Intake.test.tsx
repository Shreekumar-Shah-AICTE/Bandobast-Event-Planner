import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { rupees } from '../../domain/money.js';
import { aiOk, mockAi } from '../../test/ai.js';
import { TODAY } from '../../test/fixtures.js';
import { Intake } from './Intake.js';
import { EMPTY_FORM, fillFrom, parseBudget, parseGuests, validate } from './form.js';

const setup = () => {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<Intake today={TODAY} onDone={onDone} onCancel={onCancel} />);
  return { user, onDone, onCancel };
};

describe('Intake form', () => {
  it('lists every problem, linked to its field, and focuses the list', async () => {
    const { user, onDone } = setup();
    await user.click(screen.getByRole('button', { name: 'Make my plan' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('heading')).toHaveTextContent('Please fix 6 things');
    expect(within(summary).getByRole('link', { name: /number of guests/ })).toHaveAttribute(
      'href',
      '#field-guests',
    );
    expect(within(summary).getByRole('link', { name: /kind of event/ })).toHaveAttribute(
      'href',
      '#eventType-wedding',
    );
    expect(screen.getByLabelText('Number of guests')).toHaveAttribute('aria-invalid', 'true');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('builds a profile from the fields', async () => {
    const { user, onDone } = setup();
    await user.click(screen.getByLabelText('Birthday'));
    await user.type(screen.getByLabelText('Name of the plan'), "Meera's 30th");
    await user.type(screen.getByLabelText('City or town'), 'Indore');
    fireEvent.change(screen.getByLabelText('Date of the event'), {
      target: { value: '2027-01-15' },
    });
    await user.type(screen.getByLabelText('Number of guests'), '60');
    await user.type(screen.getByLabelText('Total budget'), '2 lakh');
    expect(screen.getByText(/Reads as ₹2,00,000/)).toBeInTheDocument();
    const priorities = screen.getByRole('group', { name: 'What matters most?' });
    const boxes = within(priorities).getAllByRole('checkbox');
    for (const box of boxes.slice(0, 3)) await user.click(box);
    expect(boxes[3]).toBeDisabled();
    await user.click(boxes[0]!);
    expect(boxes[3]).toBeEnabled();
    await user.click(screen.getByLabelText('Many kids'));
    await user.click(screen.getByLabelText('Jain vegetarian'));
    await user.click(screen.getByLabelText('Modern'));
    await user.click(screen.getByRole('button', { name: 'Make my plan' }));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'birthday',
        title: "Meera's 30th",
        guests: 60,
        budgetPaise: rupees(200_000),
        audience: ['kids'],
        diet: 'jain',
        style: 'modern',
      }),
    );
  });

  it('fills the form from a description read by Gemini', async () => {
    mockAi(() =>
      aiOk({
        eventType: 'wedding',
        title: "Asha's wedding",
        city: 'Jaipur',
        eventDate: '2027-02-14',
        guests: 300,
        budgetRupees: 1_800_000,
        priorities: ['catering', 'decor'],
        audience: ['elders'],
        diet: 'veg',
        style: 'traditional',
      }),
    );
    const { user, onDone } = setup();
    await user.type(
      screen.getByLabelText('What are you planning?'),
      "My sister Asha's wedding in Jaipur",
    );
    await user.click(screen.getByRole('button', { name: 'Fill the form from this' }));
    expect(await screen.findByText(/Filled in: kind of event, name, city/)).toBeInTheDocument();
    expect(screen.getByText(/Read by Gemini/)).toBeInTheDocument();
    expect(screen.getByLabelText('City or town')).toHaveValue('Jaipur');
    expect(screen.getByLabelText('Total budget')).toHaveValue('₹18,00,000');
    await user.click(screen.getByRole('button', { name: 'Make my plan' }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ city: 'Jaipur', guests: 300 }));
  });

  it('says when nothing could be read', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('What are you planning?'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Fill the form from this' }));
    expect(await screen.findByText(/Nothing could be read/)).toBeInTheDocument();
  });

  it('goes back on request', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('form helpers', () => {
  it('reads guest counts and budgets within limits', () => {
    expect(parseGuests('1,200')).toBe(1200);
    expect(parseGuests('')).toBeNull();
    expect(parseGuests('12.5')).toBeNull();
    expect(parseGuests('999999')).toBeNull();
    expect(parseBudget('12 lakh')).toBe(rupees(1_200_000));
    expect(parseBudget('500')).toBeNull();
    expect(parseBudget('lots')).toBeNull();
  });

  it('rejects past dates and keeps unread fields', () => {
    const past = validate({ ...EMPTY_FORM, eventDate: '2026-01-01' }, TODAY);
    expect(past.errors.find((e) => e.field === 'eventDate')?.message).toMatch(/after today/);
    const kept = fillFrom({ ...EMPTY_FORM, city: 'Pune' }, { guests: 80 });
    expect(kept).toMatchObject({ city: 'Pune', guests: '80', budget: '' });
  });
});
