/**
 * Each reader asks the AI first and falls back to the built-in rules, and says
 * which one answered. AI answers have already passed the server's checks; the
 * parts that matter are checked again here with the same domain code.
 */
import { changeFromWire, type AiOutput } from '../../shared/aiContracts.js';
import { LIMITS } from '../../shared/limits.js';
import {
  QuoteDraftSchema,
  type CategoryId,
  type Change,
  type EventProfile,
  type QuoteDraft,
} from '../../shared/schemas.js';
import { parseChangeText, type ParsedChanges } from '../domain/changeParser.js';
import type { IsoDate } from '../domain/dates.js';
import { explainScenarios, fillPlaceholders, scenarioPlaceholders } from '../domain/explain.js';
import { redactContacts } from '../domain/grounding.js';
import { acceptAiIdeas, type Idea, type Refinement } from '../domain/ideas.js';
import { readFreeText, sanitise, type IntakeDraft } from '../domain/intake.js';
import { rupees } from '../domain/money.js';
import { parseQuoteText } from '../domain/quoteParser.js';
import type { Scenario } from '../domain/scenarios.js';
import { templateFor } from '../domain/templates/index.js';
import { askAi, FALLBACK_NOTES } from './client.js';

/** A reading and who produced it. `note` explains a fallback to the rules. */
export interface Reading<T> {
  readonly value: T;
  readonly source: 'ai' | 'rules';
  readonly model: string | null;
  readonly note: string | null;
}

const byAi = <T>(value: T, model: string): Reading<T> => ({
  value,
  source: 'ai',
  model,
  note: null,
});
const byRules = <T>(value: T, note: string | null): Reading<T> => ({
  value,
  source: 'rules',
  model: null,
  note,
});

const isChange = (change: Change | null): change is Change => change !== null;

/** Change request → changes. Clauses the AI could not map get a second try with the rules. */
export async function readChange(
  text: string,
  profile: EventProfile,
  today: IsoDate,
  signal: AbortSignal,
): Promise<Reading<ParsedChanges>> {
  const { tasks } = templateFor(profile.eventType);
  const rules = parseChangeText(text, tasks, today);
  const ai = await askAi('change', { text, today, eventType: profile.eventType }, signal);
  if (!ai.ok) return byRules(rules, FALLBACK_NOTES[ai.reason]);
  const changes = ai.data.changes.map(changeFromWire).filter(isChange);
  if (changes.length === 0) return byRules(rules, null);
  const rest = parseChangeText(ai.data.unparsed.join(', '), tasks, today);
  return byAi({ changes: [...changes, ...rest.changes], unparsed: rest.unparsed }, ai.model);
}

function draftFromAi(out: AiOutput<'intake'>, today: IsoDate): IntakeDraft {
  const { budgetRupees, ...rest } = out;
  const candidate = { ...rest, budgetPaise: budgetRupees === null ? null : rupees(budgetRupees) };
  const present = Object.entries(candidate).filter(
    ([, value]) => value !== null && !(Array.isArray(value) && value.length === 0),
  );
  return sanitise(Object.fromEntries(present), today);
}

/** One message describing the event → profile fields (the AI fills what the rules miss). */
export async function readIntake(
  text: string,
  today: IsoDate,
  signal: AbortSignal,
): Promise<Reading<IntakeDraft>> {
  const rules = readFreeText(text, today);
  const ai = await askAi('intake', { text, today }, signal);
  if (!ai.ok) return byRules(rules, FALLBACK_NOTES[ai.reason]);
  return byAi({ ...rules, ...draftFromAi(ai.data, today) }, ai.model);
}

function draftFromQuote(out: AiOutput<'quote'>, category: CategoryId, fallbackName: string) {
  return QuoteDraftSchema.safeParse({
    vendorName: out.vendorName ?? fallbackName,
    category,
    items: out.items.map(({ quantity, ...item }) =>
      quantity === null ? item : { ...item, quantity },
    ),
    gst: out.gst,
    notes: out.notes,
    ...(out.minGuarantee === null ? {} : { minGuarantee: out.minGuarantee }),
    ...(out.gstRatePct === null ? {} : { gstRatePct: out.gstRatePct }),
  });
}

/** Pasted vendor quote → itemised draft. Phone numbers and e-mails are removed before sending. */
export async function readQuote(
  pasted: string,
  category: CategoryId,
  signal: AbortSignal,
): Promise<Reading<QuoteDraft> & { readonly text: string }> {
  const text = redactContacts(pasted).slice(0, LIMITS.maxQuoteTextLength);
  const rules = parseQuoteText(text, category);
  const ai = await askAi('quote', { text, category }, signal);
  const draft = ai.ok ? draftFromQuote(ai.data, category, rules.vendorName) : null;
  if (ai.ok && draft?.success === true && draft.data.items.length > 0) {
    return { ...byAi(draft.data, ai.model), text };
  }
  return { ...byRules(rules, ai.ok ? null : FALLBACK_NOTES[ai.reason]), text };
}

/** Extra ideas from the AI, filtered again by the same rules as on the server. */
export async function moreIdeas(
  profile: EventProfile,
  refinement: Refinement | null,
  shown: readonly Idea[],
  signal: AbortSignal,
): Promise<Reading<readonly Idea[]>> {
  const { eventType, guests, city, audience, diet, style } = profile;
  const seen = shown.map(({ title, costLevel }) => ({ title, costLevel }));
  const ai = await askAi(
    'ideas',
    { eventType, guests, city, audience, diet, style, refinement, shown: seen },
    signal,
  );
  if (!ai.ok) return byRules([], FALLBACK_NOTES[ai.reason]);
  return byAi(acceptAiIdeas(ai.data.ideas, { eventType, refinement, shown: seen }), ai.model);
}

/** Plain-language comparison of rebalance options; every amount is filled in by code. */
export async function explainOptions(
  scenarios: readonly Scenario[],
  signal: AbortSignal,
): Promise<Reading<string>> {
  const fallback = explainScenarios(scenarios);
  if (scenarios.length === 0) return byRules(fallback, null);
  const values = scenarioPlaceholders(scenarios);
  const ai = await askAi(
    'explain',
    {
      scenarios: scenarios.slice(0, LIMITS.maxScenarios).map((s) => ({
        id: s.id,
        label: s.label,
        painLevel: s.painLevel,
        description: s.description.slice(0, LIMITS.maxShortText),
      })),
      placeholders: Object.keys(values).slice(0, LIMITS.maxPlaceholders),
    },
    signal,
  );
  if (!ai.ok) return byRules(fallback, FALLBACK_NOTES[ai.reason]);
  const filled = fillPlaceholders(ai.data.text, values);
  return filled.ok ? byAi(filled.value, ai.model) : byRules(fallback, FALLBACK_NOTES.invalid);
}
