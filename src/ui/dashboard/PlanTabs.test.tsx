import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPlan } from '../../test/render.js';
import { targetIndex } from '../common/Tabs.js';

describe('plan tabs', () => {
  it('moves focus from the selected tab into its panel with Tab', async () => {
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('moves between tabs with the arrow keys, Home and End', async () => {
    const { user } = renderPlan();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    await user.click(overview);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Budget' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Budget');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /History/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /History/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
    await user.keyboard('a');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
  });

  it('points only the selected tab at its panel, which is on the page', async () => {
    const { user } = renderPlan();
    const controlled = () =>
      screen.getAllByRole('tab').filter((tab) => tab.hasAttribute('aria-controls'));
    expect(controlled()).toEqual([screen.getByRole('tab', { name: 'Overview' })]);
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const [budget] = controlled();
    expect(budget).toHaveAccessibleName('Budget');
    expect(document.getElementById(budget?.getAttribute('aria-controls') ?? '')).toBe(
      screen.getByRole('tabpanel'),
    );
  });

  it('jumps from the overview to a tab and focuses it', async () => {
    const { user } = renderPlan();
    const overview = screen.getByRole('tabpanel');
    expect(within(overview).getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    await user.click(within(overview).getByRole('button', { name: 'Open the budget' }));
    expect(screen.getByRole('tab', { name: 'Budget' })).toHaveFocus();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'Open the timeline' }));
    expect(screen.getByRole('tab', { name: /Timeline/ })).toHaveFocus();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'Open vendors' }));
    expect(screen.getByRole('tab', { name: 'Vendors' })).toHaveFocus();
  });

  it('maps keys to tab positions', () => {
    expect(targetIndex('ArrowRight', 6, 7)).toBe(0);
    expect(targetIndex('ArrowLeft', 0, 7)).toBe(6);
    expect(targetIndex('Enter', 2, 7)).toBeNull();
  });
});
