/**
 * Per-task prompt and code checks. A model answer is used only after it passes
 * the output schema and these checks: amounts and counts must be written in the
 * user's text, names and evidence must be quoted from it, task ids must exist,
 * ideas must not name prices, contacts or businesses, and explanations may not
 * contain digits. Whatever fails a check is dropped, never repaired.
 */
import { z } from 'zod';
import {
  AI_CONTRACTS,
  changeFromWire,
  type AiInput,
  type AiOutput,
  type AiTask,
  type ChangeWire,
} from '../shared/aiContracts.js';
import { LIMITS } from '../shared/limits.js';
import { field } from '../src/domain/access.js';
import { DAYS_PER_MONTH, DAYS_PER_WEEK, NUMBER_WORDS } from '../src/domain/constants.js';
import { addDays } from '../src/domain/dates.js';
import { fillPlaceholders } from '../src/domain/explain.js';
import { amountAppears, quotedFrom, redactContacts } from '../src/domain/grounding.js';
import { acceptAiIdeas } from '../src/domain/ideas.js';
import { err, ok, type Result } from '../src/domain/result.js';
import { templateFor } from '../src/domain/templates/index.js';
import { SERVER_CONFIG } from './config.js';
import { changePrompt, explainPrompt, ideasPrompt, intakePrompt, quotePrompt } from './prompts.js';

/**
 * Words that are also ordinary words ("a", "an", "do", "teen", "char") count as
 * numbers only right before a time unit: "a week", "do hafte".
 */
const UNIT_ONLY_WORDS: readonly string[] = ['a', 'an', 'do', 'teen', 'char'];
const TIME_UNIT = String.raw`(?:days?|din|weeks?|hafte|hafta|months?|mahine|mahina)`;
const STANDALONE_WORDS = Object.keys(NUMBER_WORDS).filter(
  (word) => !UNIT_ONLY_WORDS.includes(word),
);
const NUMBER_WORD_RE = new RegExp(
  String.raw`\b(?:${STANDALONE_WORDS.join('|')})\b|\b(?:${UNIT_ONLY_WORDS.join('|')})(?=\s+${TIME_UNIT}\b)`,
  'giu',
);
const NUMERAL_RE = /\d+(?:\.\d+)?/gu;
const PERCENT_RE = /(\d+(?:\.\d+)?)\s*%/gu;

/** Every whole number written in the text, in digits or as an English/Hinglish word. O(n). */
function numbersIn(text: string): number[] {
  const digits = [...text.replaceAll(',', '').matchAll(/\d+/gu)].map((match) => Number(match[0]));
  const words = [...text.matchAll(NUMBER_WORD_RE)].map((match) =>
    field(NUMBER_WORDS, match[0].toLowerCase()),
  );
  return [...digits, ...words];
}

/** True when the number is written in the text as a number of its own ("250", "2,50", "12.5"). */
const written = (value: number, text: string): boolean =>
  [...text.replaceAll(',', '').matchAll(NUMERAL_RE)].some((match) => Number(match[0]) === value);

/** The value when the check passes, otherwise null. */
const keep = <T>(value: T | null, check: (present: T) => boolean): T | null =>
  value !== null && check(value) ? value : null;

export function guardIntake(out: AiOutput<'intake'>, input: AiInput<'intake'>): AiOutput<'intake'> {
  const { text, today } = input;
  const latest = addDays(today, SERVER_CONFIG.maxEventDaysAhead);
  return {
    ...out,
    title: keep(out.title, (title) => quotedFrom(title, text)),
    city: keep(out.city, (city) => quotedFrom(city, text)),
    eventDate: keep(out.eventDate, (date) => date > today && date <= latest),
    guests: keep(out.guests, (guests) => written(guests, text)),
    budgetRupees: keep(out.budgetRupees, (amount) => amountAppears(amount, text)),
  };
}

const size = (wire: ChangeWire): number => Math.abs(Number(wire.value));

/** Days as written: a number of days, weeks or months ("14 days", "2 weeks", "ek mahina"). */
const DAY_UNITS = [1, DAYS_PER_WEEK, DAYS_PER_MONTH] as const;
const daysWritten = (days: number, evidence: string): boolean =>
  numbersIn(evidence).some((count) => DAY_UNITS.some((unit) => count * unit === days));

/** The numbers a change claims must be written in its own evidence. */
const NUMBERS_HOLD: Readonly<Record<ChangeWire['kind'], (wire: ChangeWire) => boolean>> = {
  budget: (wire) =>
    wire.mode === 'addPct'
      ? written(size(wire), wire.evidence)
      : amountAppears(size(wire), wire.evidence),
  guests: (wire) => numbersIn(wire.evidence).includes(size(wire)),
  dateShift: (wire) => daysWritten(size(wire), wire.evidence),
  taskDelay: (wire) => daysWritten(size(wire), wire.evidence),
  dateSet: () => true,
  taskDone: () => true,
};

export function guardChange(out: AiOutput<'change'>, input: AiInput<'change'>): AiOutput<'change'> {
  const taskIds = new Set(templateFor(input.eventType).tasks.map((task) => task.id));
  const kept = out.changes.filter(
    (wire) =>
      quotedFrom(wire.evidence, input.text) &&
      changeFromWire(wire) !== null &&
      NUMBERS_HOLD[wire.kind](wire) &&
      (wire.taskId === null || taskIds.has(wire.taskId)),
  );
  const dropped = out.changes.filter((wire) => !kept.includes(wire)).map((wire) => wire.evidence);
  const unparsed = [...out.unparsed, ...dropped].map((clause) =>
    clause.slice(0, LIMITS.maxShortText),
  );
  return { changes: kept, unparsed: unparsed.slice(0, LIMITS.maxChanges) };
}

export function guardQuote(out: AiOutput<'quote'>, input: AiInput<'quote'>): AiOutput<'quote'> {
  const { text } = input;
  const rateWritten = (rate: number): boolean =>
    [...text.matchAll(PERCENT_RE)].some((match) => Number(match[1]) === rate);
  return {
    ...out,
    vendorName: keep(out.vendorName, (name) => quotedFrom(name, text)),
    items: out.items
      .filter((item) => amountAppears(item.amountRupees, text))
      .map((item) => ({ ...item, quantity: keep(item.quantity, (count) => written(count, text)) })),
    minGuarantee: keep(out.minGuarantee, (count) => written(count, text)),
    gstRatePct: keep(out.gstRatePct, rateWritten),
    // Notes are shown to the user, so they must be the vendor's own words.
    notes: out.notes.filter((note) => quotedFrom(note, text)).map(redactContacts),
  };
}

export function guardIdeas(
  out: AiOutput<'ideas'>,
  input: AiInput<'ideas'>,
): AiOutput<'ideas'> | null {
  const accepted = acceptAiIdeas(out.ideas, {
    eventType: input.eventType,
    refinement: input.refinement,
    shown: input.shown,
  });
  const titles = new Set(accepted.map((entry) => entry.title.toLowerCase()));
  const unique = new Map(
    out.ideas
      .filter((idea) => titles.has(idea.title.toLowerCase()))
      .map((idea) => [idea.title.toLowerCase(), idea]),
  );
  return unique.size > 0 ? { ideas: [...unique.values()] } : null;
}

export function guardExplain(
  out: AiOutput<'explain'>,
  input: AiInput<'explain'>,
): AiOutput<'explain'> | null {
  const keys = Object.fromEntries(input.placeholders.map((key) => [key, key]));
  return fillPlaceholders(out.text, keys).ok ? out : null;
}

/** A task with everything typed; {@link prepare} erases the types behind one closure. */
interface TaskSpec<I, O> {
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly prompt: (input: I) => string;
  readonly guard: (output: O, input: I) => O | null;
  readonly maxOutputTokens: number;
}

/** A validated request, ready for the model. */
export interface PreparedTask {
  readonly prompt: string;
  /** JSON Schema for structured output. */
  readonly schema: unknown;
  readonly maxOutputTokens: number;
  /** Canonical input, used for the cache key. */
  readonly inputJson: string;
  /** Schema-checks then code-checks a model (or cached) answer. */
  readonly accept: (answer: unknown) => Result<unknown, 'schema' | 'guard'>;
}

/**
 * Keywords Gemini's constrained decoding enforces. Numeric bounds, lengths and
 * patterns are left out (they can make a schema too complex to serve); zod
 * re-checks every one of them in code before an answer is used.
 */
const MODEL_SCHEMA_KEYS: readonly string[] = [
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'anyOf',
  'additionalProperties',
  'minItems',
  'maxItems',
  'description',
];

function forModel(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(forModel);
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => MODEL_SCHEMA_KEYS.includes(key))
      .map(([key, value]) => [key, key === 'properties' ? eachProperty(value) : forModel(value)]),
  );
}

/** `properties` maps names to schemas: keep every name, clean each schema. */
const eachProperty = (properties: unknown): unknown =>
  Object.fromEntries(
    Object.entries(properties as Record<string, unknown>).map(([name, schema]) => [
      name,
      forModel(schema),
    ]),
  );

/** JSON Schema for Gemini structured output, reduced to the enforced keywords. */
export const responseSchema = (output: z.ZodType): unknown => forModel(z.toJSONSchema(output));

function prepare<I, O>(spec: TaskSpec<I, O>): (raw: unknown) => PreparedTask | null {
  const schema = responseSchema(spec.output);
  return (raw) => {
    const parsed = spec.input.safeParse(raw);
    if (!parsed.success) return null;
    const input = parsed.data;
    return {
      prompt: spec.prompt(input),
      schema,
      maxOutputTokens: spec.maxOutputTokens,
      inputJson: JSON.stringify(input),
      accept: (answer) => {
        const output = spec.output.safeParse(answer);
        if (!output.success) return err('schema');
        const checked = spec.guard(output.data, input);
        return checked === null ? err('guard') : ok(checked);
      },
    };
  };
}

const tokens = SERVER_CONFIG.maxOutputTokens;

/** Each task: validate input → prompt → (model) → validate output → code checks. */
export const TASKS: Readonly<Record<AiTask, (raw: unknown) => PreparedTask | null>> = {
  intake: prepare({
    ...AI_CONTRACTS.intake,
    prompt: intakePrompt,
    guard: guardIntake,
    maxOutputTokens: tokens.intake,
  }),
  change: prepare({
    ...AI_CONTRACTS.change,
    prompt: changePrompt,
    guard: guardChange,
    maxOutputTokens: tokens.change,
  }),
  quote: prepare({
    ...AI_CONTRACTS.quote,
    prompt: quotePrompt,
    guard: guardQuote,
    maxOutputTokens: tokens.quote,
  }),
  ideas: prepare({
    ...AI_CONTRACTS.ideas,
    prompt: ideasPrompt,
    guard: guardIdeas,
    maxOutputTokens: tokens.ideas,
  }),
  explain: prepare({
    ...AI_CONTRACTS.explain,
    prompt: explainPrompt,
    guard: guardExplain,
    maxOutputTokens: tokens.explain,
  }),
};
