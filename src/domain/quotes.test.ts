import { describe, expect, it } from 'vitest';
import type { Quote } from '../../shared/schemas.js';
import { CATERER_TEXT, quote } from '../test/fixtures.js';
import { rupees } from './money.js';
import { parseQuoteText } from './quoteParser.js';
import { analyseQuote, compareQuotes, hiddenCharges } from './quotes.js';

describe('Quotes: pasted caterer quote (₹850 a plate, 250-plate minimum, GST 5% extra)', () => {
  it('reads the WhatsApp text into a draft without the AI', () => {
    const draft = parseQuoteText(CATERER_TEXT, 'catering');
    expect(draft.vendorName).toBe('Shree Ganesh Caterers - Wedding quote');
    expect(draft.items).toEqual([
      { label: 'Veg buffet per plate', unit: 'perGuest', amountRupees: 850 },
      { label: 'Live counter (chaat)', unit: 'fixed', amountRupees: 25_000 },
    ]);
    expect(draft.minGuarantee).toBe(250);
    expect(draft).toMatchObject({ gst: 'extra', gstRatePct: 5 });
  });

  it('charges the 250-plate minimum for 200 guests and adds 5% GST', () => {
    const analysis = analyseQuote(quote(), 200);
    expect(analysis.chargedGuests).toBe(250);
    expect(analysis.subtotal).toBe(rupees(850 * 250 + 25_000));
    expect(analysis.low).toBe(rupees(249_375));
    expect(analysis.high).toBe(rupees(249_375));
    expect(analysis.unverified).toEqual([]);
    expect(analysis.clarifications).toEqual([]);
  });

  it('flags transport and GST lines as possible extra charges', () => {
    expect(analyseQuote(quote(), 200).hiddenCharges).toEqual([
      'Transport extra as per actuals',
      'GST 5% extra',
    ]);
  });

  it('charges real guests once they pass the minimum', () => {
    const analysis = analyseQuote(quote(), 300);
    expect(analysis.chargedGuests).toBe(300);
    expect(analysis.subtotal).toBe(rupees(850 * 300 + 25_000));
  });

  it('excludes an amount that is not written in the text and asks to confirm it', () => {
    const invented = quote({
      items: [...quote().items, { label: 'Welcome drinks', unit: 'perGuest', amountRupees: 90 }],
    });
    const analysis = analyseQuote(invented, 200);
    expect(analysis.unverified).toEqual(['Welcome drinks']);
    expect(analysis.subtotal).toBe(rupees(850 * 250 + 25_000));
    expect(analysis.clarifications).toContain(
      'Confirm "Welcome drinks": that amount is not written in the quote text.',
    );
  });
});

describe('Quotes: GST, minimums and vague prices become questions', () => {
  const base = quote();
  const subtotal = rupees(850 * 250 + 25_000);

  it('GST unknown → a 0–18% range and a question', () => {
    const { gstRatePct: _rate, ...rest } = base;
    const analysis = analyseQuote({ ...rest, gst: 'unknown' }, 200);
    expect([analysis.low, analysis.high]).toEqual([subtotal, Math.round(subtotal * 1.18)]);
    expect(analysis.clarifications).toContain('Ask whether GST is included.');
  });

  it('GST extra at an unknown rate → a 5–18% range and a question', () => {
    const { gstRatePct: _rate, ...rest } = base;
    const analysis = analyseQuote({ ...rest, gst: 'extra' }, 200);
    expect([analysis.low, analysis.high]).toEqual([
      Math.round(subtotal * 1.05),
      Math.round(subtotal * 1.18),
    ]);
    expect(analysis.clarifications).toContain('Ask which GST rate applies (5% or 18%).');
  });

  it('GST included → no range', () => {
    const analysis = analyseQuote({ ...base, gst: 'included' }, 200);
    expect([analysis.low, analysis.high]).toEqual([subtotal, subtotal]);
  });

  it('asks for the minimum guarantee, an itemised quote and a fixed price when missing', () => {
    const { minGuarantee: _min, ...noMinimum } = base;
    expect(analyseQuote(noMinimum, 200).clarifications).toContain(
      'Ask for the minimum guarantee (the fewest plates they will charge for).',
    );
    expect(analyseQuote({ ...base, items: [] }, 200).clarifications).toContain(
      'No priced items found — ask for an itemised quote.',
    );
    const vague = quote({ sourceText: `${CATERER_TEXT}\nDecor starting ₹40,000 approx` });
    expect(analyseQuote(vague, 200).clarifications).toContain(
      'Prices are marked approximate — ask for a fixed price.',
    );
  });

  it('multiplies hourly and per-piece lines by their quantity', () => {
    const dj: Quote = quote({
      id: 'dj',
      category: 'entertainment',
      items: [{ label: 'DJ', unit: 'perHour', amountRupees: 5000, quantity: 4 }],
      sourceText: 'DJ Rs 5,000 per hour',
      gst: 'included',
    });
    expect(analyseQuote(dj, 200).subtotal).toBe(rupees(20_000));
  });

  it('keeps flagged lines short, unique and at most six', () => {
    const long = `Transport extra ${'x'.repeat(200)}`;
    const flags = hiddenCharges(
      [long, long, 'a extra', 'b extra', 'c extra', 'd extra', 'e extra', 'f extra'].join('\n'),
    );
    expect(flags).toHaveLength(6);
    expect(flags[0]?.endsWith('…')).toBe(true);
    expect(flags[0]?.length).toBe(121);
  });
});

describe('Quotes: comparing two caterers', () => {
  const cheap = analyseQuote(quote(), 200);
  const dearer = analyseQuote(
    quote({
      id: 'q2',
      vendorName: 'Annapurna',
      items: [{ label: 'Thali', unit: 'perGuest', amountRupees: 1100 }],
      sourceText: 'Thali ₹1,100 per plate, GST 5% extra',
    }),
    200,
  );
  const invented = analyseQuote(
    quote({ id: 'q3', items: [{ label: 'Buffet', unit: 'perGuest', amountRupees: 500 }] }),
    200,
  );

  it('ranks by worst-case total and picks the cheapest fully verified quote', () => {
    const comparison = compareQuotes([dearer, invented, cheap], 'catering');
    expect(comparison.rows.map((row) => row.quote.id)).toEqual(['q3', 'q1', 'q2']);
    expect(comparison.bestId).toBe('q1');
  });

  it('ignores other categories and has no best when nothing is verified', () => {
    expect(compareQuotes([cheap], 'decor')).toEqual({ category: 'decor', rows: [], bestId: null });
    expect(compareQuotes([invented], 'catering').bestId).toBeNull();
  });
});

describe('Quotes: rule-based reader for other formats', () => {
  it('reads units, GST included and falls back to safe labels', () => {
    const draft = parseQuoteText(
      'DJ ₹5,000 per hour\nGenerator Rs 3,000 per day\nCards ₹40 per card\n₹12,000\nAll prices inclusive of GST',
      'entertainment',
    );
    expect(draft.vendorName).toBe('All prices inclusive of GST');
    expect(draft.items.map((item) => [item.unit, item.amountRupees])).toEqual([
      ['perHour', 5000],
      ['perDay', 3000],
      ['perPiece', 40],
      ['fixed', 12_000],
    ]);
    expect(draft.items[3]?.label).toBe('Quoted amount');
    expect(draft.gst).toBe('included');
  });

  it('marks GST unknown and uses a default vendor name when the text has neither', () => {
    const draft = parseQuoteText('₹500', 'cake');
    expect(draft).toMatchObject({
      vendorName: 'Vendor quote',
      gst: 'unknown',
      items: [{ amountRupees: 500 }],
    });
    expect(parseQuoteText('Buffet ₹900 + GST', 'catering').gst).toBe('extra');
  });

  it('reads at most 20 items', () => {
    const text = Array.from({ length: 25 }, (_, i) => `Item ${String(i)} ₹${String(100 + i)}`).join(
      '\n',
    );
    expect(parseQuoteText(text, 'decor').items).toHaveLength(20);
  });
});

describe('Quotes: equal totals', () => {
  it('ranks the quote with fewer possible extras first', () => {
    const clean = analyseQuote(
      quote({
        id: 'clean',
        sourceText: 'Veg buffet Rs 850 per plate. Live counter ₹25,000. GST 5%',
      }),
      200,
    );
    const flagged = analyseQuote(quote({ id: 'flagged' }), 200);
    expect(clean.high).toBe(flagged.high);
    expect(compareQuotes([flagged, clean], 'catering').rows.map((r) => r.quote.id)).toEqual([
      'clean',
      'flagged',
    ]);
  });
});
