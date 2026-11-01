/** One quote, checked: real total for your guests, every item and whether it was in your text. */
import type { QuoteItem } from '../../../shared/schemas.js';
import { formatInr, rupees } from '../../domain/money.js';
import type { QuoteAnalysis } from '../../domain/quotes.js';

const UNIT_TEXT: Readonly<Record<QuoteItem['unit'], string>> = {
  perGuest: 'per guest',
  fixed: 'fixed',
  perHour: 'per hour',
  perDay: 'per day',
  perPiece: 'each',
};

/** "₹2,23,125" or "₹2,12,500 to ₹2,50,750 including GST". */
export const totalText = ({ low, high, chargedGuests }: QuoteAnalysis): string => {
  const range = low === high ? formatInr(high) : `${formatInr(low)} to ${formatInr(high)}`;
  return `${range} including GST, for ${String(chargedGuests)} guests`;
};

/** One analysed quote: its lines and totals, and the flags worth raising with the vendor. */
export function QuoteDetails({ analysis }: { readonly analysis: QuoteAnalysis }) {
  return (
    <>
      <p className="quote-total">{totalText(analysis)}</p>
      <table className="data-table">
        <caption className="visually-hidden">{`Items quoted by ${analysis.quote.vendorName}`}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Price</th>
            <th scope="col">Counted</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {analysis.items.map((entry, index) => (
            <tr key={`${entry.item.label}-${String(index)}`}>
              <th scope="row">{entry.item.label}</th>
              <td className="num">{`${formatInr(rupees(entry.item.amountRupees))} ${UNIT_TEXT[entry.item.unit]}`}</td>
              <td className="num">{String(entry.quantity)}</td>
              <td className="num">
                {entry.verified ? formatInr(entry.total) : 'Not in your text'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <QuoteFlags analysis={analysis} />
    </>
  );
}

function QuoteFlags({ analysis }: { readonly analysis: QuoteAnalysis }) {
  const { unverified, hiddenCharges, clarifications, quote } = analysis;
  return (
    <>
      {unverified.length > 0 && (
        <p className="warning-text">{`Left out of the total because the price is not in your text: ${unverified.join(', ')}.`}</p>
      )}
      <FlagList title="Lines that may add cost" items={hiddenCharges} quoted />
      <FlagList title="Ask before booking" items={clarifications} />
      <FlagList title="Notes in the quote" items={quote.notes} quoted />
    </>
  );
}

interface FlagListProps {
  readonly title: string;
  readonly items: readonly string[];
  readonly quoted?: boolean;
}

function FlagList({ title, items, quoted = false }: FlagListProps) {
  if (items.length === 0) return null;
  return (
    <div className="flags">
      <h5>{title}</h5>
      <ul>
        {items.map((text) => (
          <li key={text}>{quoted ? <q>{text}</q> : text}</li>
        ))}
      </ul>
    </div>
  );
}
