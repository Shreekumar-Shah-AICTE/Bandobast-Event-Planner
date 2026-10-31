import { describe, expect, it } from 'vitest';
import { weddingProfile } from '../test/fixtures.js';
import { rupees } from './money.js';
import {
  STATUS_LABELS,
  buildVendorCards,
  canMove,
  nextStatuses,
  questionsFor,
  requirementsFor,
} from './vendors.js';

describe('Vendors: status moves one step at a time', () => {
  it('allows to contact → contacted → quote received → booked, and stepping back', () => {
    expect(nextStatuses('todo')).toEqual(['contacted', 'quoted']);
    expect(canMove('contacted', 'quoted')).toBe(true);
    expect(canMove('quoted', 'booked')).toBe(true);
    expect(canMove('booked', 'quoted')).toBe(true);
    expect(canMove('todo', 'booked')).toBe(false);
    expect(canMove('booked', 'booked')).toBe(true);
    expect(STATUS_LABELS.todo).toBe('To contact');
  });
});

describe('Vendors: requirements and questions tailored to this event', () => {
  const profile = weddingProfile();

  it('venue: seats with 10% headroom, lift access for elders, and the budget line', () => {
    expect(requirementsFor('venue', profile, rupees(250_000))).toEqual([
      'Seats at least 220 guests',
      'Lift or ground-floor hall for elders',
      'Budget line: ₹2.5 lakh',
    ]);
    const everyone = weddingProfile({ audience: ['accessibility', 'outstation'] });
    expect(requirementsFor('venue', everyone, 0)).toEqual(
      expect.arrayContaining([
        'Step-free entry and an accessible washroom',
        'Rooms nearby for outstation guests',
      ]),
    );
  });

  it('catering: plates, diet, a Jain counter and kids counter when needed', () => {
    expect(requirementsFor('catering', profile, 0)[0]).toBe('200 plates, vegetarian menu');
    const jain = weddingProfile({ diet: 'jain', audience: ['kids'] });
    expect(requirementsFor('catering', jain, 0)).toEqual(
      expect.arrayContaining(['Separate Jain counter', "Kids' counter"]),
    );
  });

  it('decor, sound, permits and entertainment add their own needs', () => {
    expect(requirementsFor('decor', weddingProfile({ style: 'eco' }), 0)).toContain(
      'No single-use plastic',
    );
    expect(requirementsFor('sound', profile, 0)).toContain('Clear sound for 200 people');
    expect(requirementsFor('permits', profile, 0)[0]).toContain('Written permission');
    expect(requirementsFor('entertainment', weddingProfile({ audience: ['kids'] }), 0)).toContain(
      'Kid-friendly activities',
    );
    expect(requirementsFor('gifts', profile, 0)).toEqual(['Budget line: ₹0']);
  });

  it('adds tailored questions for elders to the standard venue questions', () => {
    const questions = questionsFor('venue', profile);
    expect(questions.length).toBeGreaterThan(1);
    expect(questions).toContain(
      'Is there a lift or step-free access, and seating near the stage for elders?',
    );
    expect(questionsFor('venue', weddingProfile({ audience: [] }))).not.toContain(
      'Is there a lift or step-free access, and seating near the stage for elders?',
    );
  });

  it('builds one card per budget line with status and quote count', () => {
    const cards = buildVendorCards({
      profile,
      categories: [
        { category: 'venue', planned: rupees(250_000) },
        { category: 'catering', planned: rupees(400_000) },
      ],
      statuses: { catering: 'quoted' },
      quoteCounts: new Map([['catering', 2]]),
    });
    expect(cards.map((c) => [c.category, c.status, c.quoteCount])).toEqual([
      ['venue', 'todo', 0],
      ['catering', 'quoted', 2],
    ]);
    expect(cards[0]?.vendor.length).toBeGreaterThan(0);
  });
});
