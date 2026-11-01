/** History tab: every saved version, what each changed, restore, plan files, and start over. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import type { PlanVersion } from '../../../shared/schemas.js';
import { formatDate, type IsoDate } from '../../domain/dates.js';
import { diffPlans } from '../../domain/diff.js';
import { buildPlan } from '../../domain/plan.js';
import type { PlanAction, PlanState } from '../../state/planState.js';
import { useFocusOnMount } from '../common/hooks.js';
import { PlanFiles } from '../common/PlanFile.js';
import { LineChanges, ProfileChanges } from '../dashboard/ImpactParts.js';

interface HistoryProps {
  readonly state: PlanState;
  readonly today: IsoDate;
  readonly dispatch: (action: PlanAction) => void;
}

/**
 * The History tab: every kept version, newest first, with what it changed and a button to restore
 * it.
 */
export function HistoryPanel({ state, today, dispatch }: HistoryProps) {
  const newestFirst = state.versions.toReversed();
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">History</h2>
      <p>{`Change requests, restores, your numbers and quotes each save a version in this browser (the last ${String(LIMITS.maxVersions)} are kept). Ticks and statuses update the version on screen.`}</p>
      <ol className="history-list">
        {newestFirst.map((entry, index) => (
          <VersionItem
            key={entry.version}
            entry={entry}
            previous={newestFirst[index + 1]}
            current={entry.version === state.current}
            today={today}
            onRestore={() => {
              dispatch({ type: 'restore', version: entry.version, today });
            }}
          />
        ))}
      </ol>
      <PlanFiles
        state={state}
        onLoad={(saved) => {
          dispatch({ type: 'load', saved });
        }}
      />
      <StartOver
        onReset={() => {
          dispatch({ type: 'reset' });
        }}
      />
    </section>
  );
}

interface VersionItemProps {
  readonly entry: PlanVersion;
  readonly previous: PlanVersion | undefined;
  readonly current: boolean;
  readonly today: IsoDate;
  readonly onRestore: () => void;
}

function VersionItem({ entry, previous, current, today, onRestore }: VersionItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className="version">
      <p>
        <strong>{`Version ${String(entry.version)}`}</strong>
        {` · ${formatDate(entry.createdOn)} · ${entry.label}`}
        {current && (
          <>
            {' '}
            <span className="badge">On screen</span>
          </>
        )}
      </p>
      <div className="actions">
        {previous !== undefined && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
            }}
          >
            {open ? 'Hide what changed' : 'Show what changed'}{' '}
            <span className="visually-hidden">in version {entry.version}</span>
          </button>
        )}
        {!current && (
          <button type="button" onClick={onRestore}>
            {`Restore version ${String(entry.version)}`}
          </button>
        )}
      </div>
      {open && previous !== undefined && (
        <VersionDiff before={previous} after={entry} today={today} />
      )}
    </li>
  );
}

interface VersionDiffProps {
  readonly before: PlanVersion;
  readonly after: PlanVersion;
  readonly today: IsoDate;
}

function VersionDiff({ before, after, today }: VersionDiffProps) {
  const report = useMemo(
    () => diffPlans(buildPlan(before.input, today), buildPlan(after.input, today)),
    [before.input, after.input, today],
  );
  if (report.isEmpty) return <p>No change to the plan.</p>;
  return (
    <div className="version-diff">
      <ProfileChanges report={report} />
      <LineChanges report={report} />
    </div>
  );
}

function StartOver({ onReset }: { readonly onReset: () => void }) {
  const [asking, setAsking] = useState(false);
  const start = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);
  useEffect(() => {
    if (asking || !returning.current) return;
    returning.current = false;
    start.current?.focus();
  }, [asking]);
  if (!asking) {
    return (
      <button
        ref={start}
        type="button"
        className="danger"
        onClick={() => {
          setAsking(true);
        }}
      >
        Start over
      </button>
    );
  }
  return (
    <ConfirmReset
      onReset={onReset}
      onKeep={() => {
        returning.current = true;
        setAsking(false);
      }}
    />
  );
}

function ConfirmReset({
  onReset,
  onKeep,
}: {
  readonly onReset: () => void;
  readonly onKeep: () => void;
}) {
  const keep = useFocusOnMount<HTMLButtonElement>();
  return (
    <div className="danger-zone" role="group" aria-labelledby="reset-question">
      <p id="reset-question">
        This deletes the plan and its history from this browser. It cannot be undone.
      </p>
      <button type="button" className="danger" onClick={onReset}>
        Yes, delete my plan
      </button>
      <button type="button" ref={keep} onClick={onKeep}>
        Keep my plan
      </button>
    </div>
  );
}
