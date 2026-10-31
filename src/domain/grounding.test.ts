import { describe, expect, it } from 'vitest';
import { amountAppears, mentionsPriceOrVendor, quotedFrom, redactContacts } from './grounding.js';

describe('Quotes: grounding checks', () => {
  const text = 'Veg buffet Rs 850 per plate, decor package 1.2 lakh, DJ 35k, total ₹3,45,000';

  it('accepts amounts written in the text in any notation', () => {
    expect(amountAppears(850, text)).toBe(true);
    expect(amountAppears(120_000, text)).toBe(true);
    expect(amountAppears(35_000, text)).toBe(true);
    expect(amountAppears(345_000, text)).toBe(true);
  });

  it('rejects amounts the text does not contain', () => {
    expect(amountAppears(900, text)).toBe(false);
    expect(amountAppears(170_000, text)).toBe(false);
  });

  it('matches quoted evidence ignoring case and spacing', () => {
    expect(quotedFrom('BUDGET  down 10%', 'ok so budget down 10% please')).toBe(true);
    expect(quotedFrom('budget up', 'budget down 10%')).toBe(false);
    expect(quotedFrom('   ', 'anything')).toBe(false);
  });

  it('redacts phone numbers and e-mails', () => {
    const redacted = redactContacts(
      'Call +91 98765 43210 or 9876543210, mail ravi.caterer@example.com',
    );
    expect(redacted).toBe('Call [phone] or [phone], mail [email]');
    expect(redactContacts('Rs 1,20,000 for 250 plates')).toBe('Rs 1,20,000 for 250 plates');
  });

  it('flags prices, contacts and business names in idea text', () => {
    expect(mentionsPriceOrVendor('A chaat counter for about ₹20,000')).toBe(true);
    expect(mentionsPriceOrVendor('Book Sharma Caterers for the night')).toBe(true);
    expect(mentionsPriceOrVendor('See www.example.com')).toBe(true);
    expect(mentionsPriceOrVendor('Call 98765 43210 for lights')).toBe(true);
    expect(mentionsPriceOrVendor('Ring 9876543210 today')).toBe(true);
    expect(mentionsPriceOrVendor('A marigold photo corner for family groups')).toBe(false);
  });
});
