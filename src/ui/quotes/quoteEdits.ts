/** Plan-input edits for quotes: save, use in the budget, mark booked, remove. */
import type { CategoryId, PlanInput, Quote, QuoteDraft } from '../../../shared/schemas.js';
import type { IsoDate } from '../../domain/dates.js';

/** Next free id ("q1", "q2", …), never reusing a removed one's number while it is saved. O(q). */
export function nextQuoteId(quotes: readonly Quote[]): string {
  const used = quotes.map((quote) => Number(quote.id.replace(/^q/u, ''))).filter(Number.isInteger);
  return `q${String(Math.max(0, ...used) + 1)}`;
}

/** Adds a checked quote to the plan with a new id. */
export function addQuote(
  input: PlanInput,
  draft: QuoteDraft,
  source: { readonly text: string; readonly today: IsoDate },
): PlanInput {
  const quote: Quote = {
    ...draft,
    id: nextQuoteId(input.quotes),
    sourceText: source.text,
    addedOn: source.today,
  };
  return { ...input, quotes: [...input.quotes, quote] };
}

/** Puts a quote's worst-case total in the budget line, optionally as booked. O(1). */
export function applyQuote(input: PlanInput, quote: Quote, booked: boolean): PlanInput {
  const category: CategoryId = quote.category;
  return {
    ...input,
    overrides: { ...input.overrides, [category]: { kind: 'quote', quoteId: quote.id, booked } },
    vendors: booked ? { ...input.vendors, [category]: 'booked' } : input.vendors,
  };
}

/** Removes a quote and any budget line that used it. O(q). */
export function removeQuote(input: PlanInput, quote: Quote): PlanInput {
  const override = input.overrides[quote.category];
  const usesIt = override?.kind === 'quote' && override.quoteId === quote.id;
  const { [quote.category]: _removed, ...rest } = input.overrides;
  return {
    ...input,
    quotes: input.quotes.filter((entry) => entry.id !== quote.id),
    overrides: usesIt ? rest : input.overrides,
  };
}
