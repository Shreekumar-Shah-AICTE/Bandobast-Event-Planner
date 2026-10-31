import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/limits.js';
import type { PlanInput } from '../../../shared/schemas.js';
import { aiOk, mockAi } from '../../test/ai.js';
import { CATERER_TEXT, quote, weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

const SHREE = 'Shree Ganesh Caterers';

const openQuotes = async (extra: Partial<PlanInput> = {}) => {
  const view = renderPlan(weddingProfile(), extra);
  await view.user.click(screen.getByRole('tab', { name: /^Quotes/ }));
  return view;
};

const readSample = async (user: UserEvent, sample: string) => {
  await user.click(screen.getByRole('button', { name: sample }));
  await user.click(screen.getByRole('button', { name: 'Read this quote' }));
  return screen.findByRole('heading', { name: /^Read: / });
};

const aiQuote = {
  vendorName: SHREE,
  items: [
    { label: 'Veg buffet', unit: 'perGuest', amountRupees: 850, quantity: null },
    { label: 'Mocktail bar', unit: 'fixed', amountRupees: 12_000, quantity: null },
  ],
  minGuarantee: 250,
  gst: 'extra',
  gstRatePct: 5,
  notes: ['Transport extra as per actuals'],
};

describe('quotes tab', () => {
  it('reads a quote with the rules when the AI is down, then saves it', async () => {
    const { user } = await openQuotes();
    expect(screen.getByRole('button', { name: 'Read this quote' })).toBeDisabled();
    const heading = await readSample(user, SHREE);
    expect(heading).toHaveFocus();
    expect(screen.getByText(/built-in rules read this/)).toBeInTheDocument();
    expect(screen.getByText(/for 250 guests/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save this quote' }));
    expect(screen.getByText(/Saved the quote from Shree Ganesh Caterers/)).toBeInTheDocument();
    expect(screen.getByLabelText('Paste the quote')).toHaveFocus();
    expect(screen.getByLabelText('Paste the quote')).toHaveValue('');
    expect(screen.getByRole('tab', { name: 'Quotes (1 saved)' })).toBeInTheDocument();
  });

  it('shows what Gemini read, leaving out a price that is not in the text', async () => {
    mockAi((task) => (task === 'quote' ? aiOk(aiQuote) : aiOk(null)));
    const { user } = await openQuotes();
    await readSample(user, SHREE);
    expect(screen.getByText(/Read by Gemini/)).toBeInTheDocument();
    expect(screen.getByText('Not in your text')).toBeInTheDocument();
    expect(
      screen.getByText(/Left out of the total because the price is not in your text: Mocktail bar/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Transport extra as per actuals')).toHaveLength(2);
  });

  it('discards a reading and returns to the text box', async () => {
    const { user } = await openQuotes();
    await readSample(user, 'Annapurna Caterers');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('heading', { name: /^Read: / })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Paste the quote')).toHaveFocus();
  });

  it('compares two quotes for the same line and marks the best value', async () => {
    const { user } = await openQuotes();
    expect(screen.getByLabelText('Budget line')).toHaveValue('catering');
    await readSample(user, SHREE);
    await user.click(screen.getByRole('button', { name: 'Save this quote' }));
    await readSample(user, 'Annapurna Caterers');
    await user.click(screen.getByRole('button', { name: 'Save this quote' }));
    expect(
      screen.getByRole('heading', { name: 'Food & catering: lowest worst case first' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Best value')).toHaveLength(1);
  });

  it('uses a quote in the budget, books it, then removes it', async () => {
    const { user } = await openQuotes({ quotes: [quote({ sourceText: CATERER_TEXT })] });
    const card = () => screen.getByRole('heading', { name: SHREE, level: 4 });
    await user.click(screen.getByRole('button', { name: `Use in the budget: ${SHREE}` }));
    expect(card()).toHaveFocus();
    expect(screen.getByText(`${SHREE} is now in the budget.`)).toBeInTheDocument();
    expect(screen.getByText(/· In the budget/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Mark as booked: ${SHREE}` }));
    expect(card()).toHaveFocus();
    expect(screen.getByText(/· Booked/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const row = screen.getByRole('row', { name: /Food & catering/ });
    expect(within(row).getByText('Booked')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Quotes/ }));
    await user.click(screen.getByRole('button', { name: `Remove: ${SHREE}` }));
    expect(screen.getByRole('heading', { name: 'Quotes', level: 2 })).toHaveFocus();
    expect(screen.getByText(`Removed the quote from ${SHREE}.`)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quotes' })).toBeInTheDocument();
  });

  it('stops taking quotes at the limit', async () => {
    const quotes = Array.from({ length: LIMITS.maxQuotes }, (_, index) =>
      quote({ id: `q${String(index + 1)}`, vendorName: `Caterer ${String(index + 1)}` }),
    );
    const { user } = await openQuotes({ quotes });
    await user.type(screen.getByLabelText('Paste the quote'), 'Anything');
    expect(screen.getByRole('button', { name: 'Read this quote' })).toBeDisabled();
    expect(screen.getByText(/Remove one to add another/)).toBeInTheDocument();
  });
});
