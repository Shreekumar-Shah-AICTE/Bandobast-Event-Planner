import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rupees } from '../../domain/money.js';
import { firstVersion } from '../../domain/plan.js';
import { STORAGE_KEY } from '../../domain/storage.js';
import { TODAY, weddingProfile } from '../../test/fixtures.js';
import { renderPlan, renderVersions } from '../../test/render.js';

const openHistory = async (view: ReturnType<typeof renderPlan>) => {
  await view.user.click(screen.getByRole('tab', { name: /^History/ }));
  return view;
};

const twoVersions = () => {
  const first = firstVersion(weddingProfile(), TODAY);
  const profile = { ...first.input.profile, guests: 250 };
  const second = {
    ...first,
    version: 2,
    label: '50 more guests',
    input: { ...first.input, profile },
  };
  return [first, second];
};

describe('history tab', () => {
  it('shows what each version changed and restores an older one', async () => {
    const { user } = await openHistory(renderVersions(twoVersions(), 2));
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Version 2');
    expect(within(items[0]!).getByText('On screen')).toBeInTheDocument();
    const show = screen.getByRole('button', { name: 'Show what changed in version 2' });
    await user.click(show);
    expect(show).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Guests: 200 → 250')).toBeInTheDocument();
    expect(screen.getByText('Reserve for surprises: ₹96,000 (unchanged)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide what changed in version 2' }));
    await user.click(screen.getByRole('button', { name: 'Restore version 1' }));
    expect(screen.getByRole('heading', { name: /What changed/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'History (3 saved)' })).toBeInTheDocument();
  });

  it('says when a version changed nothing in the plan', async () => {
    const [first] = twoVersions();
    const same = { ...first!, version: 2, label: 'Same again' };
    const { user } = await openHistory(renderVersions([first!, same], 2));
    await user.click(screen.getByRole('button', { name: 'Show what changed in version 2' }));
    expect(screen.getByText('No change to the plan.')).toBeInTheDocument();
  });

  it('asks before starting over, and keeps the plan if you say so', async () => {
    const { user } = await openHistory(
      renderPlan(weddingProfile({ budgetPaise: rupees(900_000) })),
    );
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('button', { name: 'Keep my plan' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep my plan' }));
    expect(screen.getByRole('button', { name: 'Start over' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete my plan' }));
    expect(screen.getByRole('button', { name: /Try the sample/ })).toBeInTheDocument();
    window.dispatchEvent(new Event('pagehide'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
