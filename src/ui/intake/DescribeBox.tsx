/** "Describe your event in your own words": Gemini (or the rules) fills the form below. */
import { useState, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import { readIntake, type Reading } from '../../ai/readers.js';
import type { IsoDate } from '../../domain/dates.js';
import { INTAKE_STEPS, type IntakeDraft, type IntakeStep } from '../../domain/intake.js';
import { listText } from '../common/format.js';
import { useAsk } from '../common/hooks.js';
import { SourceNote } from '../common/Labels.js';

export const STEP_LABELS: Readonly<Record<IntakeStep, string>> = {
  eventType: 'kind of event',
  title: 'name',
  city: 'city',
  eventDate: 'date',
  guests: 'guests',
  budgetPaise: 'budget',
  priorities: 'priorities',
  audience: 'guest needs',
  diet: 'food',
  style: 'style',
};

/** Which fields a reading filled, in words. O(f). */
export function filledText(draft: IntakeDraft): string {
  const found = INTAKE_STEPS.filter((step) => draft[step] !== undefined);
  return found.length === 0
    ? 'Nothing could be read from that. Please fill in the form below.'
    : `Filled in: ${listText(found.map((step) => STEP_LABELS[step]))}. Please check them below.`;
}

interface DescribeBoxProps {
  readonly today: IsoDate;
  readonly onRead: (draft: IntakeDraft) => void;
}

export function DescribeBox({ today, onRead }: DescribeBoxProps) {
  const [text, setText] = useState('');
  const ask = useAsk<Reading<IntakeDraft>>();
  const read = async (event: SyntheticEvent) => {
    event.preventDefault();
    const reading = await ask.run((signal) => readIntake(text, today, signal));
    if (reading !== null) onRead(reading.value);
  };
  return (
    <form
      className="panel describe"
      aria-labelledby="describe-title"
      onSubmit={(e) => void read(e)}
    >
      <h2 id="describe-title">Describe it in your own words (optional)</h2>
      <label htmlFor="describe-text">What are you planning?</label>
      <p id="describe-hint" className="hint">
        For example: &ldquo;My sister&apos;s wedding in Jaipur on 14 Feb, about 300 guests, budget
        18 lakh, food and decor matter most, many elders, pure veg.&rdquo; Hindi-English mix is
        fine.
      </p>
      <textarea
        id="describe-text"
        rows={3}
        maxLength={LIMITS.maxIntakeAnswerLength}
        value={text}
        aria-describedby="describe-hint"
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <button type="submit" disabled={ask.busy || text.trim() === ''} aria-busy={ask.busy}>
        {ask.busy ? 'Reading…' : 'Fill the form from this'}
      </button>
      <div role="status" className="status-area">
        {ask.result !== null && (
          <>
            <p>{filledText(ask.result.value)}</p>
            <SourceNote reading={ask.result} />
          </>
        )}
      </div>
    </form>
  );
}
