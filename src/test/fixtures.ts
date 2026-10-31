/** Shared test data. The sample mirrors the in-app sample input, so tests and demo use one engine. */
import type { EventProfile, Quote } from '../../shared/schemas.js';
import { rupees } from '../domain/money.js';

export const TODAY = '2026-10-31';

export function weddingProfile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    eventType: 'wedding',
    title: "Riya & Arjun's wedding",
    city: 'Pune',
    eventDate: '2027-02-18',
    guests: 200,
    budgetPaise: rupees(1_200_000),
    priorities: ['catering', 'photography'],
    diet: 'veg',
    audience: ['elders'],
    style: 'traditional',
    ...overrides,
  };
}

export const CATERER_TEXT = `Shree Ganesh Caterers - Wedding quote
Veg buffet: Rs 850 per plate
Minimum guarantee 250 plates
Live counter (chaat): ₹25,000
Transport extra as per actuals
GST 5% extra`;

export function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q1',
    vendorName: 'Shree Ganesh Caterers',
    category: 'catering',
    items: [
      { label: 'Veg buffet', unit: 'perGuest', amountRupees: 850 },
      { label: 'Live counter (chaat)', unit: 'fixed', amountRupees: 25_000 },
    ],
    minGuarantee: 250,
    gst: 'extra',
    gstRatePct: 5,
    notes: [],
    sourceText: CATERER_TEXT,
    addedOn: TODAY,
    ...overrides,
  };
}
