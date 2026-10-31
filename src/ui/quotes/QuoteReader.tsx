/** Paste a quote → Gemini (or the rules) itemises it → review the checked result → save. */
import { useState, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import type { CategoryId, QuoteDraft } from '../../../shared/schemas.js';
import { readQuote, type Reading } from '../../ai/readers.js';
import { at } from '../../domain/access.js';
import { CATEGORIES } from '../../domain/catalog.js';
import type { IsoDate } from '../../domain/dates.js';
import { analyseQuote } from '../../domain/quotes.js';
import { SAMPLE_QUOTES } from '../../sample.js';
import { useAsk, useFocusOnMount } from '../common/hooks.js';
import { SourceNote } from '../common/Labels.js';
import type { PlanControls } from '../dashboard/controls.js';
import { QuoteDetails } from './QuoteDetails.js';
import { addQuote } from './quoteEdits.js';

type QuoteReading = Reading<QuoteDraft> & { readonly text: string };

export function QuoteReader({ controls }: { readonly controls: PlanControls }) {
  const { plan, today } = controls;
  const categories = plan.budget.lines.map((line) => line.category);
  const fallback: CategoryId = categories.includes('catering') ? 'catering' : at(categories, 0);
  const [category, setCategory] = useState<CategoryId>(fallback);
  const [text, setText] = useState('');
  const ask = useAsk<QuoteReading>();
  const full = plan.input.quotes.length >= LIMITS.maxQuotes;
  const read = async (event: SyntheticEvent) => {
    event.preventDefault();
    await ask.run((signal) => readQuote(text, category, signal));
  };
  const save = (reading: QuoteReading) => {
    const input = addQuote(plan.input, reading.value, { text: reading.text, today });
    controls.commit(input, `Added quote: ${reading.value.vendorName}`);
    ask.clear();
    setText('');
  };
  return (
    <section className="panel" aria-labelledby="quote-reader-title">
      <h3 id="quote-reader-title">Check a quote</h3>
      <form onSubmit={(event) => void read(event)}>
        <CategorySelect categories={categories} value={category} onChange={setCategory} />
        <QuoteText text={text} onText={setText} />
        <ReadButton busy={ask.busy} full={full} empty={text.trim() === ''} />
      </form>
      <p role="status" className="visually-hidden">
        {ask.busy ? 'Reading the quote…' : ''}
      </p>
      {ask.result !== null && (
        <QuoteReview
          result={ask.result}
          guests={plan.input.profile.guests}
          today={today}
          onSave={save}
          onDiscard={ask.clear}
        />
      )}
    </section>
  );
}

function ReadButton({
  busy,
  full,
  empty,
}: {
  readonly busy: boolean;
  readonly full: boolean;
  readonly empty: boolean;
}) {
  return (
    <>
      <button type="submit" className="primary" disabled={busy || full || empty} aria-busy={busy}>
        {busy ? 'Reading…' : 'Read this quote'}
      </button>
      {full && (
        <p className="hint">{`This plan keeps up to ${String(LIMITS.maxQuotes)} quotes. Remove one to add another.`}</p>
      )}
    </>
  );
}

interface CategorySelectProps {
  readonly categories: readonly CategoryId[];
  readonly value: CategoryId;
  readonly onChange: (category: CategoryId) => void;
}

function CategorySelect({ categories, value, onChange }: CategorySelectProps) {
  return (
    <>
      <label htmlFor="quote-category">Budget line</label>
      <select
        id="quote-category"
        value={value}
        onChange={(event) => {
          onChange(event.target.value as CategoryId);
        }}
      >
        {categories.map((id) => (
          <option key={id} value={id}>
            {CATEGORIES[id].label}
          </option>
        ))}
      </select>
    </>
  );
}

function QuoteText({
  text,
  onText,
}: {
  readonly text: string;
  readonly onText: (text: string) => void;
}) {
  return (
    <>
      <label htmlFor="quote-text">Paste the quote</label>
      <p id="quote-hint" className="hint">
        From WhatsApp, e-mail or a PDF. Phone numbers and e-mail addresses are removed before
        anything is sent to the AI.
      </p>
      <textarea
        id="quote-text"
        rows={6}
        maxLength={LIMITS.maxQuoteTextLength}
        value={text}
        aria-describedby="quote-hint"
        onChange={(event) => {
          onText(event.target.value);
        }}
      />
      <p className="examples">
        <span id="quote-samples">Or try a sample caterer quote:</span>
        {SAMPLE_QUOTES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="chip"
            aria-describedby="quote-samples"
            onClick={() => {
              onText(sample.text);
            }}
          >
            {sample.label}
          </button>
        ))}
      </p>
    </>
  );
}

interface QuoteReviewProps {
  readonly result: QuoteReading;
  readonly guests: number;
  readonly today: IsoDate;
  readonly onSave: (reading: QuoteReading) => void;
  readonly onDiscard: () => void;
}

function QuoteReview({ result, guests, today, onSave, onDiscard }: QuoteReviewProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const draft = { ...result.value, id: 'draft', sourceText: result.text, addedOn: today };
  return (
    <div className="quote-review">
      <h4 ref={heading} tabIndex={-1}>{`Read: ${result.value.vendorName}`}</h4>
      <SourceNote reading={result} />
      <QuoteDetails analysis={analyseQuote(draft, guests)} />
      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            onSave(result);
          }}
        >
          Save this quote
        </button>
        <button type="button" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}
