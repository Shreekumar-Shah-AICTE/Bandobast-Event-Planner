import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rupees } from '../../domain/money.js';
import { aiOk, mockAi } from '../../test/ai.js';
import { weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

const openBudget = async () => {
  const view = renderPlan(weddingProfile({ budgetPaise: rupees(900_000) }));
  await view.user.click(screen.getByRole('tab', { name: 'Budget' }));
  return view;
};

describe('budget tab', () => {
  it('labels every line with where its number came from', async () => {
    await openBudget();
    const table = screen.getByRole('table', { name: 'Where the money goes' });
    expect(within(table).getAllByText('Estimate').length).toBeGreaterThan(5);
    expect(screen.getByText(/mid-range assumptions for 200 guests/)).toBeInTheDocument();
  });

  it('takes your own number, rejects nonsense, and goes back to the estimate', async () => {
    const { user } = await openBudget();
    await user.click(screen.getByRole('button', { name: 'Set my number for Venue' }));
    const field = screen.getByLabelText('Your amount for Venue');
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'a lot');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/Enter an amount/)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '1.5 lakh');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const row = screen.getByRole('row', { name: /Venue/ });
    expect(within(row).getByText('Your number')).toBeInTheDocument();
    expect(within(row).getByText('₹1,50,000')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Set my number for Venue' })).toHaveFocus();
    await user.click(within(row).getByRole('button', { name: 'Use the estimate for Venue' }));
    expect(
      within(screen.getByRole('row', { name: /Venue/ })).getByText('Estimate'),
    ).toBeInTheDocument();
  });

  it('cancels an edit and returns focus', async () => {
    const { user } = await openBudget();
    await user.click(screen.getByRole('button', { name: 'Set my number for Décor & flowers' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Set my number for Décor & flowers' })).toHaveFocus();
  });

  it('applies a rebalance option as a new version', async () => {
    const { user } = await openBudget();
    const options = screen.getByRole('region', { name: 'Ways to rebalance' });
    await user.click(within(options).getAllByRole('button', { name: /Use this option/ })[0]!);
    expect(screen.getByRole('tab', { name: /History \(2 saved\)/ })).toBeInTheDocument();
  });

  it('compares the options in plain words with amounts filled by code', async () => {
    mockAi(() => aiOk({ text: '{{label:format}} asks the most; {{label:share}} is fairer.' }));
    const { user } = await openBudget();
    await user.click(screen.getByRole('button', { name: 'Compare these options in plain words' }));
    expect(await screen.findByText(/asks the most/)).toBeInTheDocument();
    expect(screen.getByText(/Read by Gemini/)).toBeInTheDocument();
  });

  it('says when nothing needs rebalancing', async () => {
    const { user } = renderPlan(weddingProfile({ budgetPaise: rupees(3_000_000) }));
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    expect(screen.getByText(/nothing needs rebalancing/)).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getAllByText(/to spare/).length).toBeGreaterThan(0);
  });
});
