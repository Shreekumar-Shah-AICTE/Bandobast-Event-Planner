/** What was understood, each change with the words it came from, before anything is applied. */
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

export function ChangePreview({ reading, input, problem, onApply, onCancel }: ChangePreviewProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const { changes, unparsed } = reading.value;
  return (
    <div className="change-preview">
      <h3 ref={heading} tabIndex={-1}>
        {changes.length === 0 ? 'No change found in that' : 'Check these changes'}
      </h3>
      {changes.length > 0 && (
        <ul className="change-list">
          {changes.map((change, index) => (
            <li key={`${change.kind}-${String(index)}`}>
              <strong>{describeChange(change, input)}</strong>{' '}
              <span className="evidence">
                from <q>{change.evidence}</q>
              </span>
            </li>
          ))}
        </ul>
      )}
      {unparsed.length > 0 && (
        <p className="unparsed">
          Not understood: {unparsed.map((clause) => `“${clause}”`).join(', ')}. Try wording like
          &ldquo;30 more guests&rdquo;, &ldquo;budget 10 lakh&rdquo; or &ldquo;event on 14
          Feb&rdquo;.
        </p>
      )}
      <SourceNote reading={reading} />
      {problem !== null && <p className="error-text">{problem}</p>}
      <div className="actions">
        {changes.length > 0 && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              onApply(changes);
            }}
          >
            Apply {plural(changes.length, 'change')}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
