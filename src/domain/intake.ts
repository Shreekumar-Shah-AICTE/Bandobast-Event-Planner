/**
 * Conversational intake: which question to ask next, and a rule-based reader
 * that turns a free-text answer into profile fields. The AI intake task returns
 * the same shape; both go through {@link mergeAnswer}, which only accepts
 * whitelisted, schema-valid fields.
 */
import type { z } from 'zod';
import {
  EventProfileSchema,
  type Audience,
  type CategoryId,
  type EventProfile,
  type EventType,
} from '../../shared/schemas.js';
import { LIMITS } from '../../shared/limits.js';
import { CATEGORIES } from './catalog.js';
import { parseDateText, type IsoDate } from './dates.js';
import { parseMoney, rupees } from './money.js';
import { templateFor } from './templates/index.js';

const DraftSchema = EventProfileSchema.partial();
export type IntakeDraft = z.infer<typeof DraftSchema>;
export const INTAKE_STEPS = [
  'eventType',
  'title',
  'city',
  'eventDate',
  'guests',
  'budgetPaise',
  'priorities',
  'audience',
  'diet',
  'style',
] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

const EVENT_RE: readonly (readonly [EventType, RegExp])[] = [
  ['wedding', /\b(wedding|shaadi|shadi|marriage|vivah|reception|sangeet)\b/iu],
  ['anniversary', /\b(anniversary|saalgirah)\b/iu],
  ['birthday', /\b(birthday|bday|b-day|janamdin|turns? \d+)\b/iu],
  [
    'community',
    /\b(society|community|rwa|diwali|ganpati|ganesh|navratri|garba|holi|puja|pooja|annual day|festival|mela|club)\b/iu,
  ],
];
const AUDIENCE_RE: readonly (readonly [Audience, RegExp])[] = [
  ['elders', /\b(elders?|elderly|grandparents?|seniors?|dadi|nani|dada|nana)\b/iu],
  ['kids', /\b(kids?|children|child|bachche|toddlers?)\b/iu],
  ['accessibility', /\b(wheelchairs?|accessib\w*|disabilit\w*|mobility)\b/iu],
  ['outstation', /\b(outstation|out of town|travell?ing guests|from abroad)\b/iu],
];
const CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Bangalore',
  'Hyderabad',
  'Ahmedabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Surat',
  'Jaipur',
  'Lucknow',
  'Nagpur',
  'Indore',
  'Thane',
  'Bhopal',
  'Vadodara',
  'Patna',
  'Ludhiana',
  'Agra',
  'Nashik',
  'Gurugram',
  'Gurgaon',
  'Noida',
  'Chandigarh',
  'Kochi',
  'Coimbatore',
  'Mysuru',
  'Udaipur',
  'Goa',
  'Jodhpur',
  'Amritsar',
  'Varanasi',
  'Dehradun',
  'Rajkot',
  'Guwahati',
  'Bhubaneswar',
  'Visakhapatnam',
] as const;
const GUESTS_RE =
  /\b(\d{1,4})\s*(?:\+\s*)?(guests?|people|persons|pax|log|mehmaan|attendees|members|invitees)\b/iu;
const TITLE_RE =
  /\b([A-Z][a-z]+(?:\s*(?:&|and)\s*[A-Z][a-z]+)?)['’]s\s+(?:\d{1,3}(?:st|nd|rd|th)\s+)?(wedding|birthday|anniversary|party|reception)/u;
const PRIORITY_CONTEXT =
  /\b(matter|matters|priority|priorities|important|most|focus|care about)\b/iu;

const first = <T>(pairs: readonly (readonly [T, RegExp])[], text: string): T | undefined =>
  pairs.find(([, pattern]) => pattern.test(text))?.[0];

function dietOf(text: string): EventProfile['diet'] | undefined {
  if (/\bjain\b/iu.test(text)) return 'jain';
  if (/\b(non[- ]?veg|mixed|chicken|mutton|fish)\b/iu.test(text)) return 'mixed';
  return /\b(veg|vegetarian|shakahari)\b/iu.test(text) ? 'veg' : undefined;
}

function styleOf(text: string): EventProfile['style'] | undefined {
  if (/\b(eco|green|sustainable|zero[- ]waste)\b/iu.test(text)) return 'eco';
  if (/\b(minimal|simple|intimate|small)\b/iu.test(text)) return 'minimal';
  if (/\b(modern|contemporary|trendy)\b/iu.test(text)) return 'modern';
  return /\b(traditional|classic|customs|rituals)\b/iu.test(text) ? 'traditional' : undefined;
}

function cityOf(text: string): string | undefined {
  return CITIES.find((city) => new RegExp(String.raw`\b${city}\b`, 'iu').test(text));
}

/** Categories of this event type named in `text`, in the order they are mentioned. O(c · k). */
export function categoriesIn(text: string, eventType: EventType | undefined): CategoryId[] {
  const allowed = templateFor(eventType ?? 'wedding').categories.map((entry) => entry.id);
  return allowed
    .map((id) => ({ id, at: firstMention(text, CATEGORIES[id].keywords) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.id)
    .slice(0, LIMITS.maxPriorities);
}

function firstMention(text: string, words: readonly string[]): number {
  const positions = words
    .map((word) => new RegExp(String.raw`\b${word}\b`, 'iu').exec(text)?.index ?? -1)
    .filter((index) => index >= 0);
  return positions.length > 0 ? Math.min(...positions) : -1;
}

/** Only the sentences that talk about priorities ("food and photos matter most"). */
function priorityClauses(text: string): string {
  return text
    .split(/[.;\n]/u)
    .filter((clause) => PRIORITY_CONTEXT.test(clause))
    .join('. ');
}

function audienceOf(text: string): Audience[] | undefined {
  const found = AUDIENCE_RE.filter(([, pattern]) => pattern.test(text)).map(([need]) => need);
  return found.length > 0 ? found : undefined;
}

/** Fields that any answer may fill, wherever they appear. O(n). */
export function readFreeText(text: string, today: IsoDate, eventType?: EventType): IntakeDraft {
  const guests = GUESTS_RE.exec(text);
  const budget = parseMoney(text);
  const draft: Record<string, unknown> = {
    eventType: first(EVENT_RE, text),
    title: TITLE_RE.exec(text)?.[0],
    city: cityOf(text),
    eventDate: parseDateText(text, today) ?? undefined,
    guests: guests ? Number(guests[1]) : undefined,
    budgetPaise: budget ?? undefined,
    priorities: PRIORITY_CONTEXT.test(text)
      ? categoriesIn(priorityClauses(text), eventType ?? first(EVENT_RE, text))
      : undefined,
    audience: audienceOf(text),
    diet: dietOf(text),
    style: styleOf(text),
  };
  return sanitise(draft, today);
}

const NONE_RE = /^(none|no|skip|nothing|na|n\/a|none of these)$/iu;

type DirectReader = (text: string, found: IntakeDraft, eventType?: EventType) => unknown;

/** How to read a bare answer to a specific question ("150", "Pune", "none"). */
const DIRECT: Readonly<Partial<Record<IntakeStep, DirectReader>>> = {
  title: (text, found) =>
    found.title === undefined ? text.slice(0, LIMITS.maxTitleLength) : undefined,
  city: (text, found) =>
    found.city === undefined ? text.slice(0, LIMITS.maxCityLength) : undefined,
  guests: (text) => (/^\d{1,4}$/u.test(text) ? Number(text) : undefined),
  budgetPaise: (text) => {
    const digits = text.replaceAll(',', '');
    return /^\d{4,9}$/u.test(digits) ? rupees(Number(digits)) : undefined;
  },
  priorities: (text, _found, eventType) => categoriesIn(text, eventType),
  audience: (text) => (NONE_RE.test(text) ? [] : undefined),
};

/** Reads an answer to a specific question, accepting a bare value for that field. O(n). */
export function readAnswer(
  text: string,
  asked: IntakeStep,
  today: IsoDate,
  eventType?: EventType,
): IntakeDraft {
  const found = readFreeText(text, today, eventType);
  const value = DIRECT[asked]?.(text.trim(), found, eventType);
  return value === undefined ? found : { ...found, ...sanitise({ [asked]: value }, today) };
}

/** Keeps only fields that pass the profile schema (and a future event date). O(f). */
export function sanitise(
  candidate: Readonly<Record<string, unknown>>,
  today: IsoDate,
): IntakeDraft {
  const shape = EventProfileSchema.shape;
  const draft: Record<string, unknown> = {};
  for (const step of INTAKE_STEPS) {
    const parsed = shape[step].safeParse(candidate[step]);
    const pastDate = step === 'eventDate' && parsed.success && String(parsed.data) <= today;
    if (parsed.success && !pastDate) draft[step] = parsed.data;
  }
  return DraftSchema.parse(draft);
}

/** Fills missing fields (and the one just asked) from an answer. O(f). */
export function mergeAnswer(
  draft: IntakeDraft,
  answer: IntakeDraft,
  asked: IntakeStep | null,
): IntakeDraft {
  const merged: Record<string, unknown> = { ...draft };
  for (const step of INTAKE_STEPS) {
    const value = answer[step];
    if (value !== undefined && (draft[step] === undefined || step === asked)) merged[step] = value;
  }
  return DraftSchema.parse(merged);
}

/** The first unanswered question, or null when the profile is complete. O(f). */
export const nextStep = (draft: IntakeDraft): IntakeStep | null =>
  INTAKE_STEPS.find((step) => draft[step] === undefined) ?? null;

/** Defaults used when the user skips an optional question. */
export const SKIP_DEFAULTS: Readonly<Partial<Record<IntakeStep, unknown>>> = {
  priorities: [],
  audience: [],
  diet: 'mixed',
  style: 'traditional',
};

/** The complete profile, or null while required answers are missing. O(f). */
export function toProfile(draft: IntakeDraft): EventProfile | null {
  const parsed = EventProfileSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}
