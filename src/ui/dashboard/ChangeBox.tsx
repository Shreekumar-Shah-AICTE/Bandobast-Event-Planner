/** "What changed?" — free text read by Gemini (or the rules), checked, previewed, then applied. */
import { useRef, useState, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import type { Change, PlanInput } from '../../../shared/schemas.js';
import { readChange, type Reading } from '../../ai/readers.js';
import type { ParsedChanges } from '../../domain/changeParser.js';
import { applyChanges } from '../../domain/changes.js';
import { SAMPLE_CHANGE } from '../../sample.js';
import { useAsk } from '../common/hooks.js';
import { ChangePreview } from './ChangePreview.js';
import type { PlanControls } from './controls.js';

/** Example changes offered as one-click buttons. */
export const EXAMPLES = [SAMPLE_CHANGE, 'Caterer delayed by 5 days', 'Budget is now 10 lakh'];

interface ChangeBoxProps {
  readonly controls: PlanControls;
  readonly onApply: (input: PlanInput, label: string, changes: readonly Change[]) => void;
}

/** "Something changed?": type a change or pick an example, then check what it would change. */
export function ChangeBox({ controls, onApply }: ChangeBoxProps) {
  const { plan, today } = controls;
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const ask = useAsk<Reading<ParsedChanges>>();
  const read = async (event: SyntheticEvent) => {
    event.preventDefault();
    setProblem(null);
    await ask.run((signal) => readChange(text, plan.input.profile, today, signal));
  };
  const apply = (changes: readonly Change[]) => {
    const result = applyChanges(plan.input, changes, today);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    onApply(result.value, `Change: ${text.trim()}`, changes);
    ask.clear();
    setText('');
  };
  return (
    <section className="panel change-box" aria-labelledby="change-title">
      <h2 id="change-title">Something changed?</h2>
      <ChangeForm text={text} busy={ask.busy} onText={setText} onSubmit={(e) => void read(e)} />
      <p role="status" className="visually-hidden">
        {ask.busy ? 'Reading your change…' : ''}
      </p>
      {ask.result !== null && (
        <ChangePreview
          reading={ask.result}
          input={plan.input}
          today={today}
          problem={problem}
          onApply={apply}
          onCancel={ask.clear}
        />
      )}
    </section>
  );
}

interface ChangeFormProps {
  readonly text: string;
  readonly busy: boolean;
  readonly onText: (text: string) => void;
  readonly onSubmit: (event: SyntheticEvent) => void;
}

function ChangeForm({ text, busy, onText, onSubmit }: ChangeFormProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="change-text">Tell the plan in your own words</label>
      <textarea
        id="change-text"
        ref={field}
        rows={2}
        maxLength={LIMITS.maxChangeTextLength}
        value={text}
        onChange={(event) => {
          onText(event.target.value);
        }}
      />
      <p className="examples">
        <span id="examples-label">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="chip"
            aria-describedby="examples-label"
            onClick={() => {
              onText(example);
              field.current?.focus();
            }}
          >
            {example}
          </button>
        ))}
      </p>
      <button
        type="submit"
        className="primary"
        disabled={busy || text.trim() === ''}
        aria-busy={busy}
      >
        {busy ? 'Reading…' : 'Check what this changes'}
      </button>
    </form>
  );
}
