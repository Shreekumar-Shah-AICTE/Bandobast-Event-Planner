/** Renders the whole app with a saved plan, the way a returning user would see it. */
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EventProfile, PlanInput } from '../../shared/schemas.js';
import { firstVersion } from '../domain/plan.js';
import { serialise, STORAGE_KEY } from '../domain/storage.js';
import { App } from '../ui/App.js';
import { TODAY, weddingProfile } from './fixtures.js';

export function renderApp(storage: Storage = window.localStorage, persistent = true) {
  const user = userEvent.setup();
  return { user, ...render(<App storage={storage} today={TODAY} persistent={persistent} />) };
}

export function renderPlan(
  profile: EventProfile = weddingProfile(),
  extra: Partial<PlanInput> = {},
) {
  const version = firstVersion(profile, TODAY);
  const input = { ...version.input, ...extra };
  window.localStorage.setItem(STORAGE_KEY, serialise([{ ...version, input }], 1));
  return renderApp();
}
