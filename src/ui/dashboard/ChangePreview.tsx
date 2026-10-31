/**
 * What was understood, each change with the words it came from, before anything is
 * applied. Every change can be unticked, so one misread clause never blocks the rest.
 */
import { useState } from 'react';
import type { Change, PlanInput } from '../../../shared/schemas.js';
import type { Reading } from '../../ai/readers.js';
import type { ParsedChanges } from '../../domain/changeParser.js';
import { describeChange } from '../../domain/changes.js';
import { plural } from '../common/format.js';
import { useFocusOnMount } from '../common/hooks.js';
import { SourceNote } from '../common/Labels.js';

interface ChangePreviewProps {
  readonly reading: Reading<ParsedChanges>;
  readonly input: PlanInput;
  readonly problem: string | null;
  readonly onApply: (changes: readonly Change[]) => void;
  readonly onCancel: () => void;
}

/** Indexes of the changes the user unticked, and a toggle. */
function useSkipped(): readonly [ReadonlySet<number>, (index: number) => void] {
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const toggle = (index: number): void => {
    setSkipped((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  };
  return [skipped, toggle];
}

interface ChoicesProps {
  readonly changes: readonly Change[];
  readonly input: PlanInput;
  readonly skipped: ReadonlySet<number>;
  readonly onToggle: (index: number) => void;
}

function ChangeChoices({ changes, input, skipped, onToggle }: ChoicesProps) {
  return (
    <ul className="change-list">
      {changes.map((change, index) => (
        <li key={`${change.kind}-${String(index)}`}>
          <label className="change-choice">
            <input
              type="checkbox"
              checked={!skipped.has(index)}
              onChange={() => {
                onToggle(index);
              }}
            />
            <span>
              <strong>{describeChange(change, input)}</strong>{' '}
              <span className="evidence">
                from <q>{change.evidence}</q>
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function ChangePreview({ reading, input, problem, onApply, onCancel }: ChangePreviewProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const { changes, unparsed } = reading.value;
  const [skipped, toggle] = useSkipped();
  const chosen = changes.filter((_, index) => !skipped.has(index));
  return (
    <div className="change-preview">
      <h3 ref={heading} tabIndex={-1}>
        {changes.length === 0 ? 'No change found in that' : 'Check these changes'}
      </h3>
      {changes.length > 0 && (
        <ChangeChoices changes={changes} input={input} skipped={skipped} onToggle={toggle} />
      )}
      {unparsed.length > 0 && (
        <p className="unparsed">
          Not understood: {unparsed.map((clause) => `“${clause}”`).join(', ')}. Try wording like
          &ldquo;30 more guests&rdquo;, &ldquo;budget 10 lakh&rdquo; or &ldquo;event on 14
          Feb&rdquo;.
        </p>
      )}
      <SourceNote reading={reading} />
      {problem !== null && (
        <p className="error-text" role="alert">
          {problem}
        </p>
      )}
      <div className="actions">
        {changes.length > 0 && (
          <button
            type="button"
            className="primary"
            disabled={chosen.length === 0}
            onClick={() => {
              onApply(chosen);
            }}
          >
            Apply {plural(chosen.length, 'change')}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
