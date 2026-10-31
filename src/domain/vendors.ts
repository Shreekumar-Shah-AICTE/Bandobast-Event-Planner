/**
 * Vendor checklist: what each vendor must provide for this event, the questions
 * to ask them, and a small status machine (to contact → contacted → quoted → booked).
 */
import type { CategoryId, EventProfile, VendorStatus } from '../../shared/schemas.js';
import { CATEGORIES, DIET_LABELS, STYLE_LABELS, TAILORED_QUESTIONS } from './catalog.js';
import { VENUE_HEADROOM } from './constants.js';
import { formatCompact, type Paise } from './money.js';

export interface VendorCard {
  readonly category: CategoryId;
  readonly label: string;
  readonly vendor: string;
  readonly status: VendorStatus;
  readonly requirements: readonly string[];
  readonly questions: readonly string[];
  readonly planned: Paise;
  readonly quoteCount: number;
}

const TRANSITIONS: Readonly<Record<VendorStatus, readonly VendorStatus[]>> = {
  todo: ['contacted', 'quoted'],
  contacted: ['todo', 'quoted'],
  quoted: ['contacted', 'booked'],
  booked: ['quoted'],
};

export const STATUS_LABELS: Readonly<Record<VendorStatus, string>> = {
  todo: 'To contact',
  contacted: 'Contacted',
  quoted: 'Quote received',
  booked: 'Booked',
};

/** Statuses reachable from `status` in one step. O(1). */
export const nextStatuses = (status: VendorStatus): readonly VendorStatus[] => TRANSITIONS[status];

/** True when the move is allowed (or a no-op). O(1). */
export const canMove = (from: VendorStatus, to: VendorStatus): boolean =>
  from === to || TRANSITIONS[from].includes(to);

const has = (profile: EventProfile, need: EventProfile['audience'][number]): boolean =>
  profile.audience.includes(need);

function venueNeeds(profile: EventProfile): string[] {
  return [
    `Seats at least ${String(Math.ceil(profile.guests * VENUE_HEADROOM))} guests`,
    ...(has(profile, 'elders') ? ['Lift or ground-floor hall for elders'] : []),
    ...(has(profile, 'accessibility') ? ['Step-free entry and an accessible washroom'] : []),
    ...(has(profile, 'outstation') ? ['Rooms nearby for outstation guests'] : []),
  ];
}

function cateringNeeds(profile: EventProfile): string[] {
  return [
    `${String(profile.guests)} plates, ${DIET_LABELS[profile.diet]} menu`,
    ...(profile.diet === 'jain' ? ['Separate Jain counter'] : []),
    ...(has(profile, 'elders') ? ['Less spicy, soft options for elders'] : []),
    ...(has(profile, 'kids') ? ["Kids' counter"] : []),
  ];
}

type NeedsReader = (profile: EventProfile) => string[];

const EXTRA_NEEDS: Readonly<Partial<Record<CategoryId, NeedsReader>>> = {
  venue: venueNeeds,
  catering: cateringNeeds,
  decor: (profile) => [
    `${STYLE_LABELS[profile.style]} style`,
    ...(profile.style === 'eco' ? ['No single-use plastic'] : []),
  ],
  entertainment: (profile) => (has(profile, 'kids') ? ['Kid-friendly activities'] : []),
  sound: (profile) => [
    `Clear sound for ${String(profile.guests)} people`,
    'Loudspeakers off by 10 pm unless permitted',
  ],
  permits: () => ['Written permission for any public space or loudspeaker'],
};

/** What this vendor must provide, derived from the event profile and budget line. O(1). */
export function requirementsFor(
  category: CategoryId,
  profile: EventProfile,
  planned: Paise,
): string[] {
  return [...(EXTRA_NEEDS[category]?.(profile) ?? []), `Budget line: ${formatCompact(planned)}`];
}

/** Standard questions plus ones tailored to these guests and diet. O(q). */
export function questionsFor(category: CategoryId, profile: EventProfile): string[] {
  const tailored = TAILORED_QUESTIONS.filter(
    (entry) =>
      entry.category === category &&
      (entry.need === profile.diet || profile.audience.some((need) => need === entry.need)),
  ).map((entry) => entry.text);
  return [...CATEGORIES[category].questions, ...tailored];
}

/** Parameters for {@link buildVendorCards}. */
export interface VendorParams {
  readonly profile: EventProfile;
  readonly categories: readonly { readonly category: CategoryId; readonly planned: Paise }[];
  readonly statuses: Readonly<Partial<Record<CategoryId, VendorStatus>>>;
  readonly quoteCounts: ReadonlyMap<CategoryId, number>;
}

/** One card per budget category, in template order. O(c · q). */
export function buildVendorCards(params: VendorParams): readonly VendorCard[] {
  return params.categories.map(({ category, planned }) => ({
    category,
    label: CATEGORIES[category].label,
    vendor: CATEGORIES[category].vendor,
    status: params.statuses[category] ?? 'todo',
    requirements: requirementsFor(category, params.profile, planned),
    questions: questionsFor(category, params.profile),
    planned,
    quoteCount: params.quoteCounts.get(category) ?? 0,
  }));
}
