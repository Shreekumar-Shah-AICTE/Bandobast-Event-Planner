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

  it('adds your own task, ticks it and removes it', async () => {
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: /Timeline/ }));
    const form = screen.getByRole('form', { name: 'Add your own task' });
    expect(within(form).getByLabelText('Due on')).toHaveAttribute('max', '2027-04-19');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));
    expect(within(form).getByRole('alert')).toHaveTextContent(/Name the task/);
    await user.type(within(form).getByLabelText('Your task'), 'Book the mehendi artist');
    await user.type(within(form).getByLabelText('Due on'), '2027-01-10');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));
    const box = screen.getByRole('checkbox', { name: 'Book the mehendi artist' });
    const row = box.closest('li')!;
    expect(within(row).getByText('Your task')).toBeInTheDocument();
    expect(within(row).getByText(/Due 10 Jan 2027/)).toBeInTheDocument();
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(within(row).getByRole('button', { name: 'Remove: Book the mehendi artist' }));
    expect(screen.queryByRole('checkbox', { name: 'Book the mehendi artist' })).toBeNull();
    expect(within(form).getByLabelText('Your task')).toHaveFocus();
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
