/**
 * Personalised ideas: curated library ranked for these guests, plus AI ideas that
 * pass code checks (no prices, contacts or business names; known categories;
 * "cheaper" really is cheaper).
 */
import type { CategoryId, EventProfile, EventType, REFINEMENTS } from '../../shared/schemas.js';
import { MAX_COST_LEVEL } from './constants.js';
import { mentionsPriceOrVendor } from './grounding.js';
import { IDEA_LIBRARY, type IdeaTag, type LibraryIdea } from './ideaLibrary.js';
import { templateFor } from './templates/index.js';

export type Refinement = (typeof REFINEMENTS)[number];

export interface Idea extends LibraryIdea {
  readonly id: string;
  readonly source: 'library' | 'ai';
}

const PROFILE_TAGS = (profile: EventProfile): IdeaTag[] => [
  ...profile.audience.flatMap((need): IdeaTag[] => {
    if (need === 'accessibility') return ['accessible'];
    return need === 'elders' || need === 'kids' ? [need] : [];
  }),
  ...(profile.style === 'eco' || profile.style === 'traditional' || profile.style === 'modern'
    ? [profile.style]
    : []),
];

const REFINEMENT_TAG: Readonly<Partial<Record<Refinement, IdeaTag>>> = {
  traditional: 'traditional',
  kids: 'kids',
  elders: 'elders',
  eco: 'eco',
};

/** Higher is a better fit: shared tags count, the refinement tag counts double, cheaper wins ties. */
function score(idea: LibraryIdea, tags: readonly IdeaTag[], refinement: Refinement | null): number {
  const shared = idea.tags.filter((tag) => tags.includes(tag)).length;
  const wanted = refinement === null ? undefined : REFINEMENT_TAG[refinement];
  const boost = wanted !== undefined && idea.tags.includes(wanted) ? 2 : 0;
  return shared + boost + (MAX_COST_LEVEL - idea.costLevel) / (MAX_COST_LEVEL * 2);
}

/** Library ideas for this profile, best fit first; "cheaper" keeps only the lowest cost level. O(n log n). */
export function suggestIdeas(
  profile: EventProfile,
  refinement: Refinement | null,
): readonly Idea[] {
  const tags = PROFILE_TAGS(profile);
  return IDEA_LIBRARY[profile.eventType]
    .filter((idea) => refinement !== 'cheaper' || idea.costLevel === 1)
    .map((idea, index) => ({ idea, index, fit: score(idea, tags, refinement) }))
    .sort((a, b) => b.fit - a.fit || a.index - b.index)
    .map(({ idea, index }) => ({
      ...idea,
      id: `lib-${profile.eventType}-${String(index)}`,
      source: 'library',
    }));
}

const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

/** Context for {@link acceptAiIdeas}. */
export interface IdeaContext {
  readonly eventType: EventType;
  readonly refinement: Refinement | null;
  /** Ideas already on screen (titles must not repeat; "cheaper" must beat their cost). */
  readonly shown: readonly Pick<LibraryIdea, 'title' | 'costLevel'>[];
}

/**
 * Keeps AI ideas that name no price, contact or business, use this event's categories,
 * are not duplicates, and — for "cheaper" — sit below the average cost level shown. O(n · s).
 */
export function acceptAiIdeas(
  candidates: readonly LibraryIdea[],
  context: IdeaContext,
): readonly Idea[] {
  const allowed = new Set<CategoryId>(templateFor(context.eventType).categories.map((c) => c.id));
  const seen = new Set(context.shown.map((idea) => idea.title.toLowerCase()));
  const average =
    context.shown.reduce((sum, idea) => sum + idea.costLevel, 0) /
    Math.max(1, context.shown.length);
  return candidates
    .filter((idea) => !mentionsPriceOrVendor(`${idea.title} ${idea.description}`))
    .filter((idea) => allowed.has(idea.category) && !seen.has(idea.title.toLowerCase()))
    .filter(
      (idea) =>
        context.refinement !== 'cheaper' || idea.costLevel === 1 || idea.costLevel < average,
    )
    .map((idea) => ({ ...idea, id: `ai-${slug(idea.title)}`, source: 'ai' }));
}
