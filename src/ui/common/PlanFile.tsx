/**
 * Moving a plan between devices without accounts: save it as a JSON file, open
 * that file elsewhere. An opened file passes the same checks as a saved plan,
 * and replacing an existing plan always asks first.
 */
import { useEffect, useRef, useState } from 'react';
import {
  deserialise,
  MAX_PLAN_FILE_BYTES,
  planFileName,
  serialise,
  type Persisted,
} from '../../domain/storage.js';
import type { PlanState } from '../../state/planState.js';
import { downloadText } from './download.js';
import { plural } from './format.js';
import { useFocusOnMount } from './hooks.js';

const OPEN_PROBLEMS = {
  tooLarge: 'That file is too large to be a Bandobast plan. Nothing was changed.',
  corrupt: 'That file is not a Bandobast plan, or it is damaged. Nothing was changed.',
  unsupported: 'That plan was saved by a newer version of Bandobast. Nothing was changed.',
  unreadable: 'The browser could not read that file. Nothing was changed.',
} as const;
type OpenProblem = keyof typeof OPEN_PROBLEMS;

/** Title of the version a saved plan opens on. O(v). */
const titleOf = (saved: Pick<PlanState, 'versions' | 'current'>): string =>
  saved.versions.find((entry) => entry.version === saved.current)?.input.profile.title ?? 'Plan';

export function SavePlanButton({ state }: { readonly state: PlanState }) {
  return (
    <button
      type="button"
      onClick={() => {
        const text = serialise(state.versions, state.current);
        downloadText(text, planFileName(titleOf(state)), 'application/json');
      }}
    >
      Save the plan to a file
    </button>
  );
}

async function readPlanFile(file: File): Promise<Persisted | OpenProblem> {
  if (file.size > MAX_PLAN_FILE_BYTES) return 'tooLarge';
  let text: string;
  try {
    text = await file.text();
  } catch {
    return 'unreadable';
  }
  const result = deserialise(text);
  if (result.ok) return result.value;
  return result.error === 'unsupported' ? 'unsupported' : 'corrupt';
}

interface OpenProps {
  readonly onOpen: (saved: Persisted) => void;
  /** Takes focus when it appears, e.g. after "Keep this plan". */
  readonly focus?: boolean;
}

/** A file picker styled as a button; `onOpen` runs only for a valid plan file. */
export function OpenPlanFile({ onOpen, focus = false }: OpenProps) {
  const [problem, setProblem] = useState<OpenProblem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus]);
  return (
    <>
      <label className="button file-button">
        Open a plan file
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file === undefined) return;
            void readPlanFile(file).then((read) => {
              setProblem(typeof read === 'string' ? read : null);
              if (typeof read !== 'string') onOpen(read);
            });
          }}
        />
      </label>
      {problem !== null && (
        <p className="error-text" role="alert">
          {OPEN_PROBLEMS[problem]}
        </p>
      )}
    </>
  );
}

interface ConfirmProps {
  readonly saved: Persisted;
  readonly onReplace: () => void;
  readonly onKeep: () => void;
}

function ConfirmReplace({ saved, onReplace, onKeep }: ConfirmProps) {
  const keep = useFocusOnMount<HTMLButtonElement>();
  return (
    <div className="danger-zone" role="group" aria-labelledby="replace-question">
      <p id="replace-question">
        {`Replace this plan with “${titleOf(saved)}” (${plural(saved.versions.length, 'version')})? Save this one to a file first if you want to keep it.`}
      </p>
      <button type="button" className="danger" onClick={onReplace}>
        Yes, replace my plan
      </button>
      <button type="button" ref={keep} onClick={onKeep}>
        Keep this plan
      </button>
    </div>
  );
}

/** History tab: save this plan, or open another one after confirming. */
export function PlanFiles({
  state,
  onLoad,
}: {
  readonly state: PlanState;
  readonly onLoad: (saved: Persisted) => void;
}) {
  const [pending, setPending] = useState<Persisted | null>(null);
  const [returning, setReturning] = useState(false);
  return (
    <section className="plan-files" aria-labelledby="plan-files-title">
      <h3 id="plan-files-title">Move this plan to another device</h3>
      <p>
        Save the plan to a file, then open that file in Bandobast on the other device. The file
        stays with you: nothing is uploaded.
      </p>
      {pending === null ? (
        <div className="actions">
          <SavePlanButton state={state} />
          <OpenPlanFile onOpen={setPending} focus={returning} />
        </div>
      ) : (
        <ConfirmReplace
          saved={pending}
          onReplace={() => {
            onLoad(pending);
            setPending(null);
          }}
          onKeep={() => {
            setReturning(true);
            setPending(null);
          }}
        />
      )}
    </section>
  );
}
