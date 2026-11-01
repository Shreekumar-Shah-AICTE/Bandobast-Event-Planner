/**
 * Domain data contracts (zod). The single source of truth for types used by the
 * engine, the persisted state and the AI wire format.
 */
import { z } from 'zod';
import { LIMITS } from './limits.js';

/**
 * The fixed vocabularies of a plan. Each list feeds a zod schema, and through it a type at the end
 * of this file.
 */
export const EVENT_TYPES = ['wedding', 'birthday', 'anniversary', 'community'] as const;
export const CATEGORY_IDS = [
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'attire',
  'invitations',
  'rituals',
  'cake',
  'logistics',
  'gifts',
  'permits',
  'sound',
] as const;
export const DIETS = ['veg', 'jain', 'mixed'] as const;
export const AUDIENCE = ['elders', 'kids', 'accessibility', 'outstation'] as const;
export const STYLES = ['traditional', 'modern', 'minimal', 'eco'] as const;
export const VENDOR_STATUSES = ['todo', 'contacted', 'quoted', 'booked'] as const;
export const STRATEGIES = ['balanced', 'protect', 'share'] as const;
export const QUOTE_UNITS = ['perGuest', 'fixed', 'perHour', 'perDay', 'perPiece'] as const;
export const GST_MODES = ['included', 'extra', 'unknown'] as const;
/** Relative cost of an idea, never a price: 1 = ₹, 2 = ₹₹, 3 = ₹₹₹. */
export const COST_LEVELS = { low: 1, medium: 2, high: 3 } as const;
/** Accepts only the three cost levels. */
export const CostLevelSchema = z.literal([COST_LEVELS.low, COST_LEVELS.medium, COST_LEVELS.high]);
/** Tags that match ideas to the guests and the style. */
export const IDEA_TAGS = ['elders', 'kids', 'eco', 'traditional', 'modern', 'accessible'] as const;
/** Ways to steer the idea list ("cheaper", "more traditional", …). */
export const REFINEMENTS = ['cheaper', 'traditional', 'kids', 'elders', 'eco'] as const;

/** Schemas for the vocabularies above, and for ISO calendar dates (YYYY-MM-DD). */
export const EventTypeSchema = z.enum(EVENT_TYPES);
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export const DietSchema = z.enum(DIETS);
export const AudienceSchema = z.enum(AUDIENCE);
export const StyleSchema = z.enum(STYLES);
export const IsoDateSchema = z.iso.date();
const paise = z
  .int()
  .min(0)
  .max(LIMITS.maxBudgetRupees * 100);
const evidence = z.string().trim().min(1).max(LIMITS.maxChangeTextLength);

/**
 * The event as the user describes it: type, title, city, date, guests, budget, priorities, diet,
 * audience and style.
 */
export const EventProfileSchema = z.object({
  eventType: EventTypeSchema,
  title: z.string().trim().min(1).max(LIMITS.maxTitleLength),
  city: z.string().trim().min(1).max(LIMITS.maxCityLength),
  eventDate: IsoDateSchema,
  guests: z.int().min(1).max(LIMITS.maxGuests),
  budgetPaise: z
    .int()
    .min(LIMITS.minBudgetRupees * 100)
    .max(LIMITS.maxBudgetRupees * 100),
  priorities: z.array(CategoryIdSchema).max(LIMITS.maxPriorities),
  diet: DietSchema,
  audience: z.array(AudienceSchema).max(AUDIENCE.length),
  style: StyleSchema,
});

/**
 * A budget line the user fixed: their own number, a booked amount, or a saved quote (booked or
 * not).
 */
export const OverrideSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), amountPaise: paise }),
  z.object({ kind: z.literal('booked'), amountPaise: paise }),
  z.object({
    kind: z.literal('quote'),
    quoteId: z.string().min(1).max(LIMITS.maxIdLength),
    booked: z.boolean(),
  }),
]);

/**
 * The user's progress on one task: done (and when), days of delay, and whether it was shortened.
 */
export const TaskStateSchema = z.object({
  done: z.boolean(),
  doneOn: IsoDateSchema.optional(),
  delayDays: z.int().min(0).max(LIMITS.maxDelayDays),
  /** Shortened to its minimum realistic duration. */
  compressed: z.boolean(),
});

/** One priced line of a quote, in rupees as written, with its unit and an optional quantity. */
export const QuoteItemSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.maxTitleLength),
  unit: z.enum(QUOTE_UNITS),
  amountRupees: z.number().min(0).max(LIMITS.maxBudgetRupees),
  quantity: z.int().min(1).max(LIMITS.maxGuests).optional(),
});

/** A quote read from pasted text, before it is saved to the plan. */
export const QuoteDraftSchema = z.object({
  vendorName: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.maxCityLength * 2),
  category: CategoryIdSchema,
  items: z.array(QuoteItemSchema).max(LIMITS.maxQuoteItems),
  minGuarantee: z.int().min(1).max(LIMITS.maxGuests).optional(),
  gst: z.enum(GST_MODES),
  gstRatePct: z.number().min(0).max(LIMITS.maxGstRatePct).optional(),
  notes: z.array(z.string().trim().max(LIMITS.maxShortText)).max(LIMITS.maxIdeas),
});

/** A saved quote: the draft plus its id, the pasted text and the day it was added. */
export const QuoteSchema = QuoteDraftSchema.extend({
  id: z.string().min(1).max(LIMITS.maxIdLength),
  sourceText: z.string().max(LIMITS.maxQuoteTextLength),
  addedOn: IsoDateSchema,
});

/** An advance or instalment owed to a vendor; `paidOn` is set once it is paid. */
export const PaymentSchema = z.object({
  id: z.string().min(1).max(LIMITS.maxIdLength),
  category: CategoryIdSchema,
  label: z.string().trim().min(1).max(LIMITS.maxTitleLength),
  amountPaise: paise.min(1),
  dueOn: IsoDateSchema,
  paidOn: IsoDateSchema.optional(),
});

/**
 * A task the user added. It is due `daysBefore` the event (negative = after it),
 * so it moves with the event date like the built-in tasks. Ids never clash with theirs.
 */
export const CustomTaskSchema = z.object({
  id: z.string().regex(/^my\d{1,9}$/u),
  title: z.string().trim().min(1).max(LIMITS.maxTitleLength),
  daysBefore: z.int().min(-LIMITS.maxDaysAfterEvent).max(LIMITS.maxDaysBeforeEvent),
});

/** Budget settings: the split strategy, the format options chosen and the reserve switch. */
export const SettingsSchema = z.object({
  strategy: z.enum(STRATEGIES),
  formats: z.array(z.string().min(1).max(LIMITS.maxIdLength)).max(LIMITS.maxIdeas),
  useContingency: z.boolean(),
});

/** Everything the user decided. A version stores only this, and `buildPlan` derives the rest. */
export const PlanInputSchema = z.object({
  profile: EventProfileSchema,
  overrides: z.partialRecord(CategoryIdSchema, OverrideSchema),
  tasks: z.record(z.string().max(LIMITS.maxIdLength), TaskStateSchema),
  vendors: z.partialRecord(CategoryIdSchema, z.enum(VENDOR_STATUSES)),
  quotes: z.array(QuoteSchema).max(LIMITS.maxQuotes),
  /** Plans saved before payments and custom tasks existed load with none. */
  payments: z.array(PaymentSchema).max(LIMITS.maxPayments).default([]),
  customTasks: z.array(CustomTaskSchema).max(LIMITS.maxCustomTasks).default([]),
  settings: SettingsSchema,
});

/**
 * One confirmed change (guests, budget, a date shift or a new date, a task delayed or done), with
 * the words it came from.
 */
export const ChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('guests'),
    mode: z.enum(['add', 'set']),
    value: z.int().min(-LIMITS.maxGuests).max(LIMITS.maxGuests),
    evidence,
  }),
  z.object({
    kind: z.literal('budget'),
    mode: z.enum(['add', 'addPct', 'set']),
    value: z.number().min(-LIMITS.maxBudgetRupees).max(LIMITS.maxBudgetRupees),
    evidence,
  }),
  z.object({
    kind: z.literal('dateShift'),
    value: z.int().min(-LIMITS.maxShiftDays).max(LIMITS.maxShiftDays),
    evidence,
  }),
  z.object({ kind: z.literal('dateSet'), date: IsoDateSchema, evidence }),
  z.object({
    kind: z.literal('taskDelay'),
    taskId: z.string().min(1).max(LIMITS.maxIdLength),
    value: z.int().min(1).max(LIMITS.maxDelayDays),
    evidence,
  }),
  z.object({
    kind: z.literal('taskDone'),
    taskId: z.string().min(1).max(LIMITS.maxIdLength),
    evidence,
  }),
]);

/** One saved version: its number, day, label, inputs and the changes that made it. */
export const PlanVersionSchema = z.object({
  version: z.int().min(1),
  createdOn: IsoDateSchema,
  label: z.string().max(LIMITS.maxShortText),
  input: PlanInputSchema,
  changes: z.array(ChangeSchema).max(LIMITS.maxChanges).optional(),
});

/** Types inferred from the schemas above, so each schema stays the single source of truth. */
export type EventType = z.infer<typeof EventTypeSchema>;
export type CategoryId = z.infer<typeof CategoryIdSchema>;
export type Diet = z.infer<typeof DietSchema>;
export type Audience = z.infer<typeof AudienceSchema>;
export type Style = z.infer<typeof StyleSchema>;
export type EventProfile = z.infer<typeof EventProfileSchema>;
export type Override = z.infer<typeof OverrideSchema>;
export type TaskState = z.infer<typeof TaskStateSchema>;
export type QuoteItem = z.infer<typeof QuoteItemSchema>;
export type QuoteDraft = z.infer<typeof QuoteDraftSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type CustomTask = z.infer<typeof CustomTaskSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Strategy = Settings['strategy'];
export type VendorStatus = (typeof VENDOR_STATUSES)[number];
export type PlanInput = z.infer<typeof PlanInputSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type CostLevel = z.infer<typeof CostLevelSchema>;
export type PlanVersion = z.infer<typeof PlanVersionSchema>;
