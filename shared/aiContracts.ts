/**
 * Request and response contracts for the /api/ai/:task function, shared by the
 * browser client and the server. Model output uses flat, nullable "wire" shapes
 * (easier for structured output); code converts them into domain types.
 */
import { z } from 'zod';
import { LIMITS } from './limits.js';
import {
  AUDIENCE,
  AudienceSchema,
  CategoryIdSchema,
  ChangeSchema,
  CostLevelSchema,
  DietSchema,
  EventTypeSchema,
  IsoDateSchema,
  QUOTE_UNITS,
  GST_MODES,
  IDEA_TAGS,
  REFINEMENTS,
  StyleSchema,
  type Change,
} from './schemas.js';

export const AI_TASKS = ['intake', 'change', 'quote', 'ideas', 'explain'] as const;
export type AiTask = (typeof AI_TASKS)[number];
export const AiTaskSchema = z.enum(AI_TASKS);

const text = (max: number) => z.string().trim().min(1).max(max);
const shortText = z.string().trim().max(LIMITS.maxShortText);

// ── intake: one free-text message → profile fields ──────────────────────────
export const IntakeInputSchema = z.object({
  text: text(LIMITS.maxIntakeAnswerLength),
  today: IsoDateSchema,
});
export const IntakeOutputSchema = z.object({
  eventType: EventTypeSchema.nullable(),
  title: z.string().trim().max(LIMITS.maxTitleLength).nullable(),
  city: z.string().trim().max(LIMITS.maxCityLength).nullable(),
  eventDate: IsoDateSchema.nullable(),
  guests: z.int().min(1).max(LIMITS.maxGuests).nullable(),
  budgetRupees: z.number().min(LIMITS.minBudgetRupees).max(LIMITS.maxBudgetRupees).nullable(),
  priorities: z.array(CategoryIdSchema).max(LIMITS.maxPriorities),
  audience: z.array(AudienceSchema).max(AUDIENCE.length),
  diet: DietSchema.nullable(),
  style: StyleSchema.nullable(),
});

// ── change: a change request → validated changes with evidence ──────────────
export const CHANGE_KINDS = [
  'guests',
  'budget',
  'dateShift',
  'dateSet',
  'taskDelay',
  'taskDone',
] as const;
export const ChangeInputSchema = z.object({
  text: text(LIMITS.maxChangeTextLength),
  today: IsoDateSchema,
  eventType: EventTypeSchema,
});
export const ChangeWireSchema = z.object({
  kind: z.enum(CHANGE_KINDS),
  mode: z.enum(['add', 'addPct', 'set']).nullable(),
  value: z.number().nullable(),
  date: IsoDateSchema.nullable(),
  taskId: z.string().max(LIMITS.maxIdLength).nullable(),
  evidence: z.string().trim().max(LIMITS.maxChangeTextLength),
});
export type ChangeWire = z.infer<typeof ChangeWireSchema>;
/**
 * Turns a flat wire change into a domain change, or null when its fields do not
 * fit its kind. The result is re-validated with the domain schema. O(1).
 */
export function changeFromWire(wire: ChangeWire): Change | null {
  const { kind, mode, value, date, taskId, evidence } = wire;
  const candidate: Record<Change['kind'], unknown> = {
    guests: { kind, mode, value, evidence },
    budget: { kind, mode, value, evidence },
    dateShift: { kind, value, evidence },
    dateSet: { kind, date, evidence },
    taskDelay: { kind, taskId, value, evidence },
    taskDone: { kind, taskId, evidence },
  };
  const parsed = ChangeSchema.safeParse(candidate[kind]);
  return parsed.success ? parsed.data : null;
}

export const ChangeOutputSchema = z.object({
  changes: z.array(ChangeWireSchema).max(LIMITS.maxChanges),
  unparsed: z.array(shortText).max(LIMITS.maxChanges),
});

// ── quote: pasted vendor quote → itemised draft ─────────────────────────────
export const QuoteInputSchema = z.object({
  text: text(LIMITS.maxQuoteTextLength),
  category: CategoryIdSchema,
});
export const QuoteOutputSchema = z.object({
  vendorName: z
    .string()
    .trim()
    .max(LIMITS.maxCityLength * 2)
    .nullable(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(LIMITS.maxTitleLength),
        unit: z.enum(QUOTE_UNITS),
        amountRupees: z.number().min(0).max(LIMITS.maxBudgetRupees),
        quantity: z.int().min(1).max(LIMITS.maxGuests).nullable(),
      }),
    )
    .max(LIMITS.maxQuoteItems),
  minGuarantee: z.int().min(1).max(LIMITS.maxGuests).nullable(),
  gst: z.enum(GST_MODES),
  gstRatePct: z.number().min(0).max(LIMITS.maxGstRatePct).nullable(),
  notes: z.array(shortText).max(LIMITS.maxIdeas),
});

// ── ideas: profile summary (no names) → personalised ideas ──────────────────
const costLevel = CostLevelSchema;
export const IdeasInputSchema = z.object({
  eventType: EventTypeSchema,
  guests: z.int().min(1).max(LIMITS.maxGuests),
  city: z.string().trim().min(1).max(LIMITS.maxCityLength),
  audience: z.array(AudienceSchema).max(AUDIENCE.length),
  diet: DietSchema,
  style: StyleSchema,
  refinement: z.enum(REFINEMENTS).nullable(),
  shown: z
    .array(z.object({ title: z.string().trim().max(LIMITS.maxTitleLength), costLevel }))
    .max(LIMITS.maxBriefItems * 2),
});
export const IdeaWireSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.maxTitleLength),
  description: z.string().trim().min(1).max(LIMITS.maxShortText),
  category: CategoryIdSchema,
  costLevel,
  tags: z.array(z.enum(IDEA_TAGS)).max(IDEA_TAGS.length),
});
export const IdeasOutputSchema = z.object({
  ideas: z.array(IdeaWireSchema).max(LIMITS.maxIdeas),
});

// ── explain: scenarios → plain-language comparison with {{placeholders}} ────
export const ExplainInputSchema = z.object({
  scenarios: z
    .array(
      z.object({
        id: z.enum(['protect', 'share', 'format', 'contingency']),
        label: z.string().trim().min(1).max(LIMITS.maxTitleLength),
        painLevel: z.enum(['low', 'medium', 'high']),
        description: shortText,
      }),
    )
    .min(1)
    .max(LIMITS.maxScenarios),
  placeholders: z.array(z.string().regex(/^[a-z]+(?::[a-z-]+){1,2}$/u)).max(LIMITS.maxPlaceholders),
});
export const ExplainOutputSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.maxExplainLength),
});

/** Input and output schema for each task. */
export const AI_CONTRACTS = {
  intake: { input: IntakeInputSchema, output: IntakeOutputSchema },
  change: { input: ChangeInputSchema, output: ChangeOutputSchema },
  quote: { input: QuoteInputSchema, output: QuoteOutputSchema },
  ideas: { input: IdeasInputSchema, output: IdeasOutputSchema },
  explain: { input: ExplainInputSchema, output: ExplainOutputSchema },
} as const;

export type AiInput<T extends AiTask> = z.infer<(typeof AI_CONTRACTS)[T]['input']>;
export type AiOutput<T extends AiTask> = z.infer<(typeof AI_CONTRACTS)[T]['output']>;

/** The `model` value when the answer comes from the 24-hour answer cache. */
export const CACHED_MODEL = 'cache';

/** Successful response body; `model` names the Gemini model that answered, or CACHED_MODEL. */
export interface AiSuccess<T extends AiTask> {
  readonly ok: true;
  readonly data: AiOutput<T>;
  readonly model: string;
}

/** Error body. `fallback: true` tells the client to use its built-in rules instead. */
export const AiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string().max(LIMITS.maxShortText),
  fallback: z.boolean(),
});
export type AiError = z.infer<typeof AiErrorSchema>;
