import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BudgetLine, BudgetPlan } from '../../domain/budget.js';
import type { CategoryId } from '../../../shared/schemas.js';
import { rupees } from '../../domain/money.js';
import { BudgetBar, budgetSlices } from './BudgetBar.js';

const line = (category: CategoryId, amount: number): BudgetLine => ({
  category,
  typical: rupees(amount),
  planned: rupees(amount),
  provenance: 'estimate',
  quoteId: null,
});

const plan = (lines: BudgetLine[], contingency: number): BudgetPlan => ({
  total: 0,
  lines,
  contingency: rupees(contingency),
  contingencyTarget: 0,
  need: 0,
  gap: 0,
  feasibility: 'fits',
});

const seven = [
  line('cake', 10_000),
  line('venue', 300_000),
  line('catering', 400_000),
  line('decor', 100_000),
  line('photography', 80_000),
  line('attire', 60_000),
  line('gifts', 50_000),
];

describe('budget bar', () => {
  it('shows the five biggest lines, then everything else, then the reserve', () => {
    const labels = budgetSlices(plan(seven, 0)).map((slice) => slice.label);
    expect(labels).toEqual([
      'Food & catering',
      'Venue',
      'Décor & flowers',
      'Photo & video',
      'Outfits & makeup',
      'Everything else',
    ]);
    expect(budgetSlices(plan(seven.slice(0, 2), 50_000)).at(-1)).toEqual({
      label: 'Reserve',
      amount: rupees(50_000),
    });
  });

  it('labels each slice with its amount and share, or hides the bar from screen readers', () => {
    const { container, unmount } = render(
      <BudgetBar budget={plan([line('venue', 75_000)], 25_000)} />,
    );
    const items = within(screen.getByRole('figure')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Venue ₹75,000 (75%)',
      'Reserve ₹25,000 (25%)',
    ]);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    unmount();
    render(<BudgetBar budget={plan([], 0)} legend={false} />);
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
});
