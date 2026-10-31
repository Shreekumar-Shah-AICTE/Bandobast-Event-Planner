import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { firstVersion } from '../../domain/plan.js';
import { deserialise, MAX_PLAN_FILE_BYTES, serialise } from '../../domain/storage.js';
import { TODAY, weddingProfile } from '../../test/fixtures.js';
import { renderApp, renderPlan } from '../../test/render.js';

const birthday = firstVersion(weddingProfile({ title: "Meera's 30th" }), TODAY);
const planFile = (text = serialise([birthday], 1)) =>
  new File([text], 'plan.json', { type: 'application/json' });
const picker = () => screen.getByLabelText('Open a plan file');

describe('plan files', () => {
  it('opens a saved plan file from the welcome screen', async () => {
    const { user } = renderApp();
    await user.upload(picker(), planFile());
    expect(screen.getByRole('heading', { level: 1, name: "Meera's 30th" })).toHaveFocus();
  });

  it.each([
    ['damaged', planFile('{not json'), /not a Bandobast plan/],
    ['newer', planFile(JSON.stringify({ schemaVersion: 2 })), /newer version/],
    [
      'huge',
      Object.defineProperty(planFile(), 'size', { value: MAX_PLAN_FILE_BYTES + 1 }),
      /too large/,
    ],
    [
      'unreadable',
      Object.defineProperty(planFile(), 'text', { value: () => Promise.reject(new Error('io')) }),
      /could not read/,
    ],
  ])('refuses a %s file and changes nothing', async (_name, file, message) => {
    const { user } = renderApp();
    await user.upload(picker(), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Start a new plan' })).toBeInTheDocument();
  });

  it('saves the plan to a file, and asks before another file replaces it', async () => {
    const blobs: Blob[] = [];
    const names: string[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          blobs.push(blob);
          return 'blob:plan';
        },
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: /^History/ }));
    await user.click(screen.getByRole('button', { name: 'Save the plan to a file' }));
    expect(names).toEqual(['bandobast-riya-arjun-s-wedding.json']);
    expect(deserialise(await blobs[0]!.text())).toMatchObject({ ok: true, value: { current: 1 } });
    await user.upload(picker(), planFile());
    const question = await screen.findByRole('group', {
      name: /Replace this plan with “Meera's 30th” \(1 version\)/,
    });
    await user.click(within(question).getByRole('button', { name: 'Keep this plan' }));
    expect(picker()).toHaveFocus();
    await user.upload(picker(), planFile());
    await user.click(await screen.findByRole('button', { name: 'Yes, replace my plan' }));
    expect(screen.getByRole('heading', { level: 1, name: "Meera's 30th" })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});
