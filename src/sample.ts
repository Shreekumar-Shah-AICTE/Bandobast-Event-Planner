/**
 * The demo plan: a 200-guest wedding in Pune, about 110 days away, so the
 * Change Test ("50 more guests, budget down 10%, event 2 weeks earlier") shows
 * tasks turning late and the budget going over.
 */
import type { EventProfile } from '../shared/schemas.js';
import { addDays, type IsoDate } from './domain/dates.js';
import { rupees } from './domain/money.js';

/** Days from today to the sample event. */
export const SAMPLE_LEAD_DAYS = 110;
const SAMPLE_BUDGET_RUPEES = 1_200_000;

/** The example change offered first on the plan screen. */
export const SAMPLE_CHANGE = '50 more guests, budget down 10%, event 2 weeks earlier';

/** The sample wedding (Riya & Arjun, Pune, 200 guests), set `SAMPLE_LEAD_DAYS` after `today`. */
export function sampleProfile(today: IsoDate): EventProfile {
  return {
    eventType: 'wedding',
    title: "Riya & Arjun's wedding",
    city: 'Pune',
    eventDate: addDays(today, SAMPLE_LEAD_DAYS),
    guests: 200,
    budgetPaise: rupees(SAMPLE_BUDGET_RUPEES),
    priorities: ['catering', 'photography'],
    diet: 'veg',
    audience: ['elders'],
    style: 'traditional',
  };
}

/** Two caterer quotes as people paste them from WhatsApp, for trying the quote check. */
export const SAMPLE_QUOTES = [
  {
    label: 'Shree Ganesh Caterers',
    text: `Shree Ganesh Caterers - Wedding quote
Veg buffet: Rs 850 per plate
Minimum guarantee 250 plates
Live counter (chaat): ₹25,000
Transport extra as per actuals
GST 5% extra`,
  },
  {
    label: 'Annapurna Caterers',
    text: `Annapurna Caterers, Pune
Veg thali Rs 780 per plate, minimum 300 plates
Live dosa counter Rs 18,000
Service charge 10% extra
GST 18% extra`,
  },
] as const;
