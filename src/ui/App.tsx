/** The whole app: welcome, the intake form, or the plan dashboard. */
import { useState } from 'react';
import type { EventProfile } from '../../shared/schemas.js';
import type { IsoDate } from '../domain/dates.js';
import { sampleProfile } from '../sample.js';
import type { Loaded } from '../state/persistence.js';
import { currentVersion } from '../state/planState.js';
import { usePlan } from '../state/usePlan.js';
import { Footer } from './common/Footer.js';
import { Dashboard } from './dashboard/Dashboard.js';
import { Intake } from './intake/Intake.js';
import { Welcome } from './Welcome.js';

interface AppProps {
  readonly storage: Storage;
  readonly today: IsoDate;
  /** False when the browser blocks saving and the plan lives only in this tab. */
  readonly persistent?: boolean;
}

const PROBLEM_TEXT = {
  corrupt: 'Your saved plan could not be read, so it was kept aside and you can start again.',
  unsupported: 'Your saved plan was made by a newer version of Bandobast, so it was kept aside.',
} as const;

interface ScreenProps {
  readonly store: ReturnType<typeof usePlan>;
  readonly today: IsoDate;
}

function Screen({ store, today }: ScreenProps) {
  const [intake, setIntake] = useState(false);
  const { state, dispatch } = store;
  const version = currentVersion(state);
  const start = (profile: EventProfile) => {
    dispatch({ type: 'start', profile, today });
    setIntake(false);
  };
  if (version !== null) {
    return <Dashboard state={state} version={version} dispatch={dispatch} today={today} />;
  }
  if (intake) {
    return (
      <Intake
        today={today}
        onDone={start}
        onCancel={() => {
          setIntake(false);
        }}
      />
    );
  }
  return (
    <Welcome
      onStart={() => {
        setIntake(true);
      }}
      onSample={() => {
        start(sampleProfile(today));
      }}
    />
  );
}

interface NoticesProps {
  readonly problem: Loaded['problem'];
  readonly saved: boolean;
}

function Notices({ problem, saved }: NoticesProps) {
  return (
    <>
      {problem !== null && (
        <p className="notice" role="status">
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      {!saved && (
        <p className="notice warning" role="alert">
          This browser did not let Bandobast save. The plan stays on screen, but it will be lost
          when you close this tab.
        </p>
      )}
    </>
  );
}

export function App({ storage, today, persistent = true }: AppProps) {
  const store = usePlan(storage);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the plan
      </a>
      <header className="site-header">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>{' '}
          Bandobast
        </p>
        <p className="tagline">Celebration planning that keeps up with change</p>
      </header>
      <main id="main" tabIndex={-1}>
        <Notices problem={store.problem} saved={store.saved && persistent} />
        <Screen store={store} today={today} />
      </main>
      <Footer />
    </>
  );
}
