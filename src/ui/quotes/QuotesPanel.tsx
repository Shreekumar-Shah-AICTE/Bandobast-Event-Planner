/** Quotes tab: check a new quote, and compare saved quotes line by line. */
import { useRef, useState } from 'react';
import type { PlanInput, Quote } from '../../../shared/schemas.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { formatDate } from '../../domain/dates.js';
import { compareQuotes, type QuoteAnalysis } from '../../domain/quotes.js';
import type { PlanControls } from '../dashboard/controls.js';
import { QuoteDetails } from './QuoteDetails.js';
import { applyQuote, removeQuote } from './quoteEdits.js';
import { QuoteReader } from './QuoteReader.js';

/** The Quotes tab: the quote checker, then each saved quote with its details and actions. */
export function QuotesPanel({ controls }: { readonly controls: PlanControls }) {
  const { plan } = controls;
  const categories = [...new Set(plan.quotes.map((analysis) => analysis.quote.category))];
  const title = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState('');
  const done = (text: string, removed: boolean) => {
    setMessage(text);
    if (removed) title.current?.focus();
  };
  return (
    <section aria-labelledby="quotes-title">
      <h2 id="quotes-title" ref={title} tabIndex={-1}>
        Quotes
      </h2>
      <p>
        Paste a vendor&apos;s quote to see the real total for your guest count, possible extra
        charges and what to ask. A price that is not in your text is never counted.
      </p>
      <p role="status" className="visually-hidden">
        {message}
      </p>
      <QuoteReader controls={controls} />
      {categories.map((category) => {
        const comparison = compareQuotes(plan.quotes, category);
        const compared = comparison.rows.length > 1;
        return (
          <section key={category} aria-labelledby={`quotes-${category}`}>
            <h3 id={`quotes-${category}`}>
              {`${CATEGORIES[category].label}${compared ? ': lowest worst case first' : ''}`}
            </h3>
            <ul className="card-grid">
              {comparison.rows.map((row) => (
                <SavedQuote
                  key={row.quote.id}
                  analysis={row}
                  best={compared && row.quote.id === comparison.bestId}
                  controls={controls}
                  onDone={done}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

/** Called after a quote action with a message to announce; `removed` when the card is gone. */
type OnDone = (message: string, removed: boolean) => void;

interface SavedQuoteProps {
  readonly analysis: QuoteAnalysis;
  readonly best: boolean;
  readonly controls: PlanControls;
  readonly onDone: OnDone;
}

/** Whether a quote is the one the budget uses, and whether it is booked. O(1). */
export function quoteUse(input: PlanInput, quote: Quote): { inBudget: boolean; booked: boolean } {
  const override = input.overrides[quote.category];
  const inBudget = override?.kind === 'quote' && override.quoteId === quote.id;
  return { inBudget, booked: inBudget && override.booked };
}

function SavedQuote({ analysis, best, controls, onDone }: SavedQuoteProps) {
  const { quote } = analysis;
  const heading = useRef<HTMLHeadingElement>(null);
  const use = quoteUse(controls.plan.input, quote);
  const state = use.booked ? ' · Booked' : use.inBudget ? ' · In the budget' : '';
  return (
    <li className="card quote-card">
      <h4 ref={heading} tabIndex={-1}>
        {quote.vendorName}
        {best && (
          <>
            {' '}
            <span className="badge badge-best">Best value</span>
          </>
        )}
      </h4>
      <p className="hint">{`Added ${formatDate(quote.addedOn)}${state}`}</p>
      <QuoteDetails analysis={analysis} />
      <QuoteActions
        quote={quote}
        controls={controls}
        {...use}
        onDone={(message, removed) => {
          // The pressed button may disappear; keep focus on this card (or the tab heading).
          if (!removed) heading.current?.focus();
          onDone(message, removed);
        }}
      />
    </li>
  );
}

interface QuoteActionsProps {
  readonly quote: Quote;
  readonly controls: PlanControls;
  readonly inBudget: boolean;
  readonly booked: boolean;
  readonly onDone: OnDone;
}

interface QuoteAction {
  readonly text: string;
  readonly next: PlanInput;
  readonly label: string;
  readonly message: string;
  readonly removed?: boolean;
}

/** The actions a saved quote offers now: use it, book it, remove it. O(1). */
function actionsFor(input: PlanInput, quote: Quote, inBudget: boolean, booked: boolean) {
  const vendor = quote.vendorName;
  const actions: QuoteAction[] = [];
  if (!inBudget) {
    const next = applyQuote(input, quote, false);
    actions.push({
      text: 'Use in the budget',
      next,
      label: `Using quote: ${vendor}`,
      message: `${vendor} is now in the budget.`,
    });
  }
  if (!booked) {
    const next = applyQuote(input, quote, true);
    actions.push({
      text: 'Mark as booked',
      next,
      label: `Booked: ${vendor}`,
      message: `${vendor} is marked as booked.`,
    });
  }
  actions.push({
    text: 'Remove',
    next: removeQuote(input, quote),
    label: `Removed quote: ${vendor}`,
    message: `Removed the quote from ${vendor}.`,
    removed: true,
  });
  return actions;
}

function QuoteActions({ quote, controls, inBudget, booked, onDone }: QuoteActionsProps) {
  const actions = actionsFor(controls.plan.input, quote, inBudget, booked);
  return (
    <div className="actions">
      {actions.map((action) => (
        <button
          key={action.text}
          type="button"
          onClick={() => {
            controls.commit(action.next, action.label);
            onDone(action.message, action.removed === true);
          }}
        >
          {action.text}
          <span className="visually-hidden">{`: ${quote.vendorName}`}</span>
        </button>
      ))}
    </div>
  );
}
