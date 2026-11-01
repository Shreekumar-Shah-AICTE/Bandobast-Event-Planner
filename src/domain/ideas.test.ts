import { describe, expect, it } from 'vitest';
import { weddingProfile } from '../test/fixtures.js';
import type { LibraryIdea } from './ideaLibrary.js';
import { acceptAiIdeas, suggestIdeas } from './ideas.js';

const profile = weddingProfile();

describe('Ideas: library suggestions ranked for these guests', () => {
  it('puts ideas for elders and a traditional style first, with stable ids', () => {
    const ideas = suggestIdeas(profile, null);
    expect(ideas.length).toBeGreaterThanOrEqual(6);
    expect(ideas[0]?.tags.some((tag) => tag === 'elders' || tag === 'traditional')).toBe(true);
    expect(
      ideas.every((idea) => idea.source === 'library' && idea.id.startsWith('lib-wedding-')),
    ).toBe(true);
    expect(suggestIdeas(profile, null)).toEqual(ideas);
  });

  it('"cheaper" keeps only the lowest-cost ideas; "kids" lifts kid ideas to the top', () => {
    expect(suggestIdeas(profile, 'cheaper').every((idea) => idea.costLevel === 1)).toBe(true);
    expect(suggestIdeas(profile, 'kids')[0]?.tags).toContain('kids');
    const eco = weddingProfile({ style: 'eco', audience: ['accessibility'] });
    expect(suggestIdeas(eco, 'eco')[0]?.tags).toContain('eco');
  });

  it('has suggestions for every event type', () => {
    for (const eventType of ['birthday', 'anniversary', 'community'] as const) {
      expect(suggestIdeas(weddingProfile({ eventType }), null).length).toBeGreaterThan(0);
    }
  });
});

describe('Ideas: AI ideas must pass code checks', () => {
  const idea = (overrides: Partial<LibraryIdea>): LibraryIdea => ({
    title: 'Marigold photo corner',
    description: 'A family photo corner framed with marigold strings.',
    category: 'decor',
    costLevel: 1,
    tags: ['traditional'],
    ...overrides,
  });
  const context = {
    eventType: profile.eventType,
    refinement: null,
    shown: suggestIdeas(profile, null),
  };

  it('keeps a clean idea and gives it an AI id', () => {
    expect(acceptAiIdeas([idea({})], context)).toEqual([
      { ...idea({}), id: 'ai-marigold-photo-corner', source: 'ai' },
    ]);
  });

  it('drops prices, contacts, business names, unknown categories and duplicates', () => {
    const rejected = [
      idea({ description: 'Costs about ₹20,000.' }),
      idea({ description: 'Call 9876543210 to book.' }),
      idea({ description: 'Book Sharma Caterers for the night.' }),
      idea({ title: 'Cake tower', category: 'cake' }),
      idea({ title: context.shown[0]!.title.toUpperCase() }),
    ];
    expect(acceptAiIdeas(rejected, context)).toEqual([]);
  });

  it('gives ideas in any script distinct, readable ids and drops repeated titles', () => {
    const accepted = acceptAiIdeas(
      [
        idea({ title: 'मेहंदी की रात' }),
        idea({ title: 'संगीत संध्या' }),
        idea({ title: 'Haldi brunch!' }),
        idea({ title: 'Haldi brunch?' }),
        idea({ title: 'संगीत संध्या' }),
      ],
      context,
    ).map((entry) => entry.id);
    expect(accepted).toEqual([
      'ai-मेहंदी-की-रात',
      'ai-संगीत-संध्या',
      'ai-haldi-brunch',
      'ai-haldi-brunch-2',
    ]);
  });

  it('for "cheaper", keeps only ideas cheaper than what is shown', () => {
    const shown = [idea({ title: 'Shown', costLevel: 2 })].map((entry) => ({
      ...entry,
      id: 'lib-wedding-0',
      source: 'library' as const,
    }));
    const cheaper = { eventType: profile.eventType, refinement: 'cheaper' as const, shown };
    expect(
      acceptAiIdeas([idea({ title: 'Dear', costLevel: 3 }), idea({ title: 'Lean' })], cheaper).map(
        (entry) => entry.title,
      ),
    ).toEqual(['Lean']);
  });
});

describe('Ideas: profiles without matching tags', () => {
  it('still ranks ideas for outstation guests and a minimal style', () => {
    const plain = weddingProfile({ audience: ['kids', 'outstation'], style: 'minimal' });
    const ideas = suggestIdeas(plain, null);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0]?.tags).toContain('kids');
  });
});
