/** The intake form's values, how a description fills them, and validation into a profile. */
import { LIMITS } from '../../../shared/limits.js';
import {
  EventProfileSchema,
  type Audience,
  type CategoryId,
  type Diet,
  type EventProfile,
  type EventType,
  type Style,
} from '../../../shared/schemas.js';
import { isIsoDate, type IsoDate } from '../../domain/dates.js';
import type { IntakeDraft } from '../../domain/intake.js';
import { formatInr, parseMoney, rupees } from '../../domain/money.js';

export interface FormValues {
  readonly eventType: EventType | null;
  readonly title: string;
  readonly city: string;
  readonly eventDate: string;
  readonly guests: string;
  readonly budget: string;
  readonly priorities: readonly CategoryId[];
  readonly audience: readonly Audience[];
  readonly diet: Diet;
  readonly style: Style;
}

export const FIELDS = ['eventType', 'title', 'city', 'eventDate', 'guests', 'budget'] as const;
export type FieldName = (typeof FIELDS)[number];

export interface FieldError {
  readonly field: FieldName;
  readonly message: string;
}

export type Validation =
  | { readonly profile: EventProfile; readonly errors: readonly [] }
  | { readonly profile: null; readonly errors: readonly FieldError[] };

export const EMPTY_FORM: FormValues = {
  eventType: null,
  title: '',
  city: '',
  eventDate: '',
  guests: '',
  budget: '',
  priorities: [],
  audience: [],
  diet: 'mixed',
  style: 'traditional',
};

const pick = <T>(found: T | undefined, current: T): T => found ?? current;

/** Copies what a description reading found into the form; other fields keep their values. O(f). */
export function fillFrom(values: FormValues, draft: IntakeDraft): FormValues {
  return {
    eventType: pick(draft.eventType, values.eventType),
    title: pick(draft.title, values.title),
    city: pick(draft.city, values.city),
    eventDate: pick(draft.eventDate, values.eventDate),
    guests: draft.guests === undefined ? values.guests : String(draft.guests),
    budget: draft.budgetPaise === undefined ? values.budget : formatInr(draft.budgetPaise),
    priorities: pick(draft.priorities, values.priorities),
    audience: pick(draft.audience, values.audience),
    diet: pick(draft.diet, values.diet),
    style: pick(draft.style, values.style),
  };
}

/** Whole number of guests within limits, or null. Accepts "1,200". O(n). */
export function parseGuests(text: string): number | null {
  const count = Number(text.trim().replaceAll(',', ''));
  const valid = Number.isInteger(count) && count >= 1 && count <= LIMITS.maxGuests;
  return valid && text.trim() !== '' ? count : null;
}

/** Budget in paise within limits ("12 lakh", "₹5,00,000"), or null. O(n). */
export function parseBudget(text: string): number | null {
  const amount = parseMoney(text);
  if (amount === null) return null;
  const valid =
    amount >= rupees(LIMITS.minBudgetRupees) && amount <= rupees(LIMITS.maxBudgetRupees);
  return valid ? amount : null;
}

const required = (text: string, message: string): string | null =>
  text.trim() === '' ? message : null;

function dateProblem(text: string, today: IsoDate): string | null {
  if (!isIsoDate(text)) return 'Enter the date of the event.';
  return text > today ? null : 'Choose a date after today.';
}

type Check = (values: FormValues, today: IsoDate) => string | null;

const CHECKS: Readonly<Record<FieldName, Check>> = {
  eventType: (v) => (v.eventType === null ? 'Choose the kind of event.' : null),
  title: (v) => required(v.title, 'Give the plan a name, for example "Riya & Arjun\'s wedding".'),
  city: (v) => required(v.city, 'Enter the city or town.'),
  eventDate: (v, today) => dateProblem(v.eventDate, today),
  guests: (v) =>
    parseGuests(v.guests) === null
      ? `Enter the number of guests, from 1 to ${LIMITS.maxGuests.toLocaleString('en-IN')}.`
      : null,
  budget: (v) =>
    parseBudget(v.budget) === null
      ? 'Enter a budget from ₹1,000 to ₹10 crore, for example "12 lakh" or "₹5,00,000".'
      : null,
};

/** Every problem in the form, in screen order, or the finished profile. O(f). */
export function validate(values: FormValues, today: IsoDate): Validation {
  const errors = FIELDS.flatMap((field) => {
    const message = CHECKS[field](values, today);
    return message === null ? [] : [{ field, message }];
  });
  const parsed = EventProfileSchema.safeParse({
    ...values,
    title: values.title.trim(),
    city: values.city.trim(),
    guests: parseGuests(values.guests),
    budgetPaise: parseBudget(values.budget),
  });
  if (errors.length === 0 && parsed.success) return { profile: parsed.data, errors: [] };
  return { profile: null, errors };
}
