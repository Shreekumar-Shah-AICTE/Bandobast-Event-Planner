/** Curated ideas per event type. Cost is a level (1 = ₹, 3 = ₹₹₹), never a price. */
import type { CategoryId, EventType } from '../../shared/schemas.js';

export const IDEA_TAGS = ['elders', 'kids', 'eco', 'traditional', 'modern', 'accessible'] as const;
export type IdeaTag = (typeof IDEA_TAGS)[number];

export interface LibraryIdea {
  readonly title: string;
  readonly description: string;
  readonly category: CategoryId;
  readonly costLevel: 1 | 2 | 3;
  readonly tags: readonly IdeaTag[];
}

export const IDEA_LIBRARY: Readonly<Record<EventType, readonly LibraryIdea[]>> = {
  wedding: [
    {
      title: 'Marigold photo corner at the haldi',
      description:
        'A wall of marigold strings and a low bench gives every family group a quick, bright photo spot.',
      category: 'decor',
      costLevel: 1,
      tags: ['traditional'],
    },
    {
      title: 'Elders’ lounge beside the mandap',
      description:
        'Cushioned chairs, water and a clear view of the pheras, so elders do not stand through the ceremony.',
      category: 'venue',
      costLevel: 1,
      tags: ['elders', 'accessible'],
    },
    {
      title: 'Live chaat counter',
      description:
        'A made-to-order chaat counter keeps guests busy before dinner and suits most diets.',
      category: 'catering',
      costLevel: 2,
      tags: ['modern'],
    },
    {
      title: 'Regional thali honouring both families',
      description: 'One course from each family’s home region, with a card explaining each dish.',
      category: 'catering',
      costLevel: 3,
      tags: ['traditional'],
    },
    {
      title: 'Steel plates and cloth napkins',
      description: 'Hire steel crockery instead of disposables to cut waste at the reception.',
      category: 'catering',
      costLevel: 1,
      tags: ['eco'],
    },
    {
      title: 'Kids’ mehendi and craft table',
      description:
        'A supervised corner with small mehendi designs and colouring keeps children happy during long rituals.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['kids'],
    },
    {
      title: 'Family dance entry for the baraat',
      description: 'Cousins rehearse one short group dance to a dhol beat for the baraat arrival.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['traditional'],
    },
    {
      title: 'Seed-paper or digital invitations',
      description: 'Plantable invitation cards for elders and a digital invite for everyone else.',
      category: 'invitations',
      costLevel: 1,
      tags: ['eco', 'modern'],
    },
  ],
  birthday: [
    {
      title: 'Treasure hunt with picture clues',
      description:
        'Clues hidden around the venue that even non-readers can follow; the prize is the cake reveal.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['kids'],
    },
    {
      title: 'Cupcake decorating corner',
      description:
        'Plain cupcakes with toppings so every child decorates and takes home their own.',
      category: 'cake',
      costLevel: 1,
      tags: ['kids'],
    },
    {
      title: 'Memory wall from every year',
      description: 'One photo from each birthday so far, pinned on a string with clips.',
      category: 'decor',
      costLevel: 1,
      tags: ['elders', 'traditional'],
    },
    {
      title: 'Plantable return gifts',
      description: 'Small pots with seeds and a care card instead of plastic toys.',
      category: 'gifts',
      costLevel: 1,
      tags: ['eco'],
    },
    {
      title: 'Magic or puppet show',
      description: 'A 40-minute show holds attention while food is set up.',
      category: 'entertainment',
      costLevel: 2,
      tags: ['kids'],
    },
    {
      title: 'Themed cake that matches the décor',
      description: 'Pick one theme and carry it through the cake, balloons and table cover.',
      category: 'cake',
      costLevel: 2,
      tags: ['modern'],
    },
  ],
  anniversary: [
    {
      title: 'Recreate the wedding-day menu',
      description: 'Ask the couple for two dishes from their wedding and serve them again.',
      category: 'catering',
      costLevel: 2,
      tags: ['traditional', 'elders'],
    },
    {
      title: 'Video messages from family far away',
      description:
        'Collect short phone videos from relatives who cannot travel and play them after dinner.',
      category: 'photography',
      costLevel: 1,
      tags: ['modern'],
    },
    {
      title: 'Old-songs antakshari',
      description: 'Songs from the year they married; elders usually lead this one.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['elders', 'traditional'],
    },
    {
      title: 'Photo timeline of the years together',
      description:
        'One photo per year along the entrance, ending with a family photo taken on the night.',
      category: 'decor',
      costLevel: 1,
      tags: ['traditional'],
    },
    {
      title: 'Live acoustic duo for an hour',
      description: 'Soft live music during dinner, with the couple’s song at the end.',
      category: 'entertainment',
      costLevel: 3,
      tags: ['modern'],
    },
    {
      title: 'Grandchildren’s welcome table',
      description: 'Grandchildren hand out flowers and run a guest book at the door.',
      category: 'gifts',
      costLevel: 1,
      tags: ['kids', 'traditional'],
    },
  ],
  community: [
    {
      title: 'Rangoli contest by building wing',
      description: 'Each wing gets a patch near the gate; residents vote by placing a diya.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['traditional'],
    },
    {
      title: 'Zero-waste food stalls',
      description: 'Steel plates, a washing station and separate bins run by volunteers.',
      category: 'catering',
      costLevel: 1,
      tags: ['eco'],
    },
    {
      title: 'Shaded seating for seniors near the stage',
      description: 'Two front rows with chairs and shade, close to washrooms and the exit.',
      category: 'venue',
      costLevel: 1,
      tags: ['elders', 'accessible'],
    },
    {
      title: 'Kids’ drawing contest with certificates',
      description: 'Age groups, one theme, and printed certificates for every participant.',
      category: 'gifts',
      costLevel: 1,
      tags: ['kids'],
    },
    {
      title: 'Residents’ talent night',
      description: 'Ten-minute slots for residents; sign-ups close a week before.',
      category: 'entertainment',
      costLevel: 1,
      tags: ['modern'],
    },
    {
      title: 'Eco-friendly idol and décor',
      description: 'Clay idol, flower and cloth décor, and a society tank for immersion.',
      category: 'decor',
      costLevel: 2,
      tags: ['eco', 'traditional'],
    },
  ],
};
