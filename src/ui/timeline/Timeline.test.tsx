import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

describe('timeline tab', () => {
  it('ticks tasks done and open again', async () => {
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: /Timeline/ }));
    const box = screen.getByRole('checkbox', { name: 'Fix the muhurat and book the priest' });
    await user.click(box);
    expect(box).toBeChecked();
    expect(screen.getAllByText(/· Done/).length).toBeGreaterThan(0);
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  it('offers ways to catch up and shortens a late task', async () => {
    const { user } = renderPlan(weddingProfile({ eventDate: '2026-12-20' }));
    await user.click(screen.getByRole('tab', { name: /Timeline \(\d+ late\)/ }));
    expect(screen.getByRole('region', { name: 'Ways to catch up' })).toBeInTheDocument();
    const shorten = screen.getAllByRole('button', { name: /Shorten it/ });
    await user.click(shorten[0]!);
    expect(screen.getAllByText(/Shortened/).length).toBeGreaterThan(0);
  });

  it('links each task to Google Calendar and downloads an .ics file', async () => {
    const create = vi.fn(() => 'blob:plan');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: /Timeline/ }));
    const list = screen.getByRole('list', { name: '' });
    expect(
      within(list).getAllByRole('link', { name: /Add to Google Calendar/ })[0],
    ).toHaveAttribute('href', expect.stringContaining('calendar.google.com'));
    await user.click(screen.getByRole('button', { name: 'Download all dates (.ics)' }));
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(revoke).toHaveBeenCalledWith('blob:plan');
    });
  });
});
