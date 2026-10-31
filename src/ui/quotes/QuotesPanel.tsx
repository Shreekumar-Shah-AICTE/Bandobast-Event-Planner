/** Quotes tab: check a new quote, and compare saved quotes line by line. */
import type { PlanInput, Quote } from '../../../shared/schemas.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { formatDate } from '../../domain/dates.js';
import { compareQuotes, type QuoteAnalysis } from '../../domain/quotes.js';
import type { PlanControls } from '../dashboard/controls.js';
import { QuoteDetails } from './QuoteDetails.js';
import { applyQuote, removeQuote } from './quoteEdits.js';
import { QuoteReader } from './QuoteReader.js';

export function QuotesPanel({ controls }: { readonly controls: PlanControls }) {
  const { plan } = controls;
  const categories = [...new Set(plan.quotes.map((analysis) => analysis.quote.category))];
  return (
    <section aria-labelledby="quotes-title">
      <h2 id="quotes-title">Quotes</h2>
      <p>
        Paste a vendor&apos;s quote to see the real total for your guest count, possible extra
        charges and what to ask. A price that is not in your text is never counted.
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
                />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

interface SavedQuoteProps {
  readonly analysis: QuoteAnalysis;
  readonly best: boolean;
  readonly controls: PlanControls;
}

/** Whether a quote is the one the budget uses, and whether it is booked. O(1). */
export function quoteUse(input: PlanInput, quote: Quote): { inBudget: boolean; booked: boolean } {
  const override = input.overrides[quote.category];
  const inBudget = override?.kind === 'quote' && override.quoteId === quote.id;
  return { inBudget, booked: inBudget && override.booked };
}

function SavedQuote({ analysis, best, controls }: SavedQuoteProps) {
  const { quote } = analysis;
  const use = quoteUse(controls.plan.input, quote);
  const state = use.booked ? ' · Booked' : use.inBudget ? ' · In the budget' : '';
  return (
    <li className="card quote-card">
      <h4>
        {quote.vendorName}
        {best && <span className="badge badge-best"> Best value</span>}
      </h4>
      <p className="hint">{`Added ${formatDate(quote.addedOn)}${state}`}</p>
      <QuoteDetails analysis={analysis} />
      <QuoteActions quote={quote} controls={controls} {...use} />
    </li>
  );
}

interface QuoteActionsProps {
  readonly quote: Quote;
  readonly controls: PlanControls;
  readonly inBudget: boolean;
  readonly booked: boolean;
}

function QuoteActions({ quote, controls, inBudget, booked }: QuoteActionsProps) {
  const { input } = controls.plan;
  const name = <span className="visually-hidden">{`: ${quote.vendorName}`}</span>;
  return (
    <div className="actions">
      {!inBudget && (
        <button
          type="button"
          onClick={() => {
            controls.commit(applyQuote(input, quote, false), `Using quote: ${quote.vendorName}`);
          }}
        >
          Use in the budget{name}
        </button>
      )}
      {!booked && (
        <button
          type="button"
          onClick={() => {
            controls.commit(applyQuote(input, quote, true), `Booked: ${quote.vendorName}`);
          }}
        >
          Mark as booked{name}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          controls.commit(removeQuote(input, quote), `Removed quote: ${quote.vendorName}`);
        }}
      >
        Remove{name}
      </button>
    </div>
  );
}
