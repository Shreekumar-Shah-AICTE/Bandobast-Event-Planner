import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../domain/storage.js';
import { rupees } from '../domain/money.js';
import { memoryStorage } from '../state/browserStorage.js';
import { aiOk, mockAi } from '../test/ai.js';
import { weddingProfile } from '../test/fixtures.js';
import { renderApp, renderPlan } from '../test/render.js';
import { quotaExceeded, storageWith } from '../test/storage.js';
import { SAMPLE_CHANGE } from '../sample.js';

describe('App', () => {
  it('welcomes a new visitor and opens the sample plan', async () => {
    const { user } = renderApp();
    // On page load the browser keeps its own start point, so the skip link comes first.
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
    await user.click(screen.getByRole('button', { name: /Try the sample/ }));
    expect(screen.getByRole('heading', { level: 1, name: "Riya & Arjun's wedding" })).toHaveFocus();
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });

  it('opens the form for a new plan and comes back', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    expect(screen.getByRole('heading', { name: 'Tell us about your event' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Start a new plan' })).toBeInTheDocument();
  });

  it('runs the Change Test with the rules when the AI is down, then undoes it', async () => {
    const { user } = renderPlan();
    await user.click(screen.getByRole('button', { name: SAMPLE_CHANGE }));
    expect(screen.getByLabelText('Tell the plan in your own words')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    const preview = await screen.findByRole('heading', { name: 'Check these changes' });
    expect(preview).toHaveFocus();
    expect(screen.getByText('Guests 200 → 250')).toBeInTheDocument();
    expect(screen.getByText(/AI is not available/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply 3 changes' }));
    const report = screen.getByRole('region', { name: 'What changed' });
    expect(within(report).getByRole('heading', { name: 'What changed' })).toHaveFocus();
    expect(within(report).getByText('Guests: 200 → 250')).toBeInTheDocument();
    expect(
      within(report).getByRole('table', { name: 'Budget lines that moved' }),
    ).toBeInTheDocument();
    await user.click(within(report).getByRole('button', { name: 'Undo this change' }));
    const undone = screen.getByRole('region', { name: 'What changed' });
    expect(within(undone).getByText('Restored version 1')).toBeInTheDocument();
    await user.click(within(undone).getByRole('button', { name: 'Close the report' }));
    expect(screen.queryByRole('region', { name: 'What changed' })).toBeNull();
  });

  it('uses Gemini changes, shows where each came from, and offers ways to rebalance', async () => {
    mockAi((task) =>
      task === 'change'
        ? aiOk({
            changes: [
              {
                kind: 'budget',
                mode: 'set',
                value: 700_000,
                date: null,
                taskId: null,
                evidence: 'budget is 7 lakh',
              },
            ],
            unparsed: ['and the moon'],
          })
        : { status: 503, body: {} },
    );
    const { user } = renderPlan();
    await user.type(
      screen.getByLabelText('Tell the plan in your own words'),
      'budget is 7 lakh and the moon',
    );
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    await screen.findByRole('heading', { name: 'Check these changes' });
    expect(screen.getByText(/Read by Gemini \(gemini-test\)/)).toBeInTheDocument();
    expect(screen.getByText(/Not understood: “and the moon”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    const report = screen.getByRole('region', { name: 'What changed' });
    const options = within(report).getByRole('region', { name: 'Ways to rebalance' });
    const before = within(report).getAllByText(/Reserve for surprises/)[0]?.textContent;
    await user.click(within(options).getAllByRole('button', { name: /Use this option/ })[0]!);
    expect(screen.getByRole('region', { name: 'What changed' })).toBeInTheDocument();
    expect(before).toBeDefined();
  });

  it('applies only the changes left ticked', async () => {
    const { user } = renderPlan();
    await user.click(screen.getByRole('button', { name: SAMPLE_CHANGE }));
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    await screen.findByRole('heading', { name: 'Check these changes' });
    const boxes = screen.getAllByRole('checkbox', { checked: true });
    for (const box of boxes) await user.click(box);
    expect(screen.getByRole('button', { name: 'Apply 0 changes' })).toBeDisabled();
    for (const box of boxes.slice(1)) await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Apply 2 changes' }));
    const report = screen.getByRole('region', { name: 'What changed' });
    expect(within(report).queryByText('Guests: 200 → 250')).toBeNull();
  });

  it('says when nothing could be read, and lets the user cancel', async () => {
    const { user } = renderPlan();
    await user.type(
      screen.getByLabelText('Tell the plan in your own words'),
      'the weather is nice',
    );
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    expect(
      await screen.findByRole('heading', { name: 'No change found in that' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'No change found in that' })).toBeNull();
  });

  it('explains a change that cannot be applied', async () => {
    mockAi(() =>
      aiOk({
        changes: [
          {
            kind: 'dateSet',
            mode: null,
            value: null,
            date: '2026-01-01',
            taskId: null,
            evidence: 'on 1 Jan',
          },
        ],
        unparsed: [],
      }),
    );
    const { user } = renderPlan();
    await user.type(screen.getByLabelText('Tell the plan in your own words'), 'move it to 1 Jan');
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    await user.click(await screen.findByRole('button', { name: 'Apply 1 change' }));
    expect(screen.getByText(/past|after today/i)).toBeInTheDocument();
  });

  it('shortens a newly late task from the report', async () => {
    const { user } = renderPlan(weddingProfile({ eventDate: '2027-01-20' }));
    await user.type(
      screen.getByLabelText('Tell the plan in your own words'),
      'event 3 weeks earlier',
    );
    await user.click(screen.getByRole('button', { name: 'Check what this changes' }));
    await user.click(await screen.findByRole('button', { name: /^Apply/ }));
    const report = screen.getByRole('region', { name: 'What changed' });
    const shorten = within(report).getAllByRole('button', { name: /Shorten it/ });
    expect(shorten.length).toBeGreaterThan(0);
    await user.click(shorten[0]!);
    expect(screen.getByRole('region', { name: 'What changed' })).toBeInTheDocument();
  });

  it('keeps an unreadable save aside and says so', () => {
    window.localStorage.setItem(STORAGE_KEY, '{oops');
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent('could not be read');
  });

  it('warns when the browser will not keep the plan', async () => {
    const blocked = storageWith(memoryStorage(), { setItem: quotaExceeded });
    const { user } = renderApp(blocked);
    await user.click(screen.getByRole('button', { name: /Try the sample/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not let Bandobast save');
  });

  it('saves at once when the tab is hidden', async () => {
    const { user } = renderPlan(weddingProfile());
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status of Caterer' }),
      'contacted',
    );
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('"catering":"contacted"');
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"catering":"contacted"');
  });

  it('warns at once when saving is blocked for the whole session', () => {
    renderApp(memoryStorage(), false);
    expect(screen.getByRole('alert')).toHaveTextContent('lost when you close this tab');
  });

  it('shows the budget check against a tight budget', () => {
    renderPlan(weddingProfile({ budgetPaise: rupees(900_000) }));
    expect(screen.getByText(/Short by/)).toBeInTheDocument();
  });
});
