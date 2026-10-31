import { describe, expect, it } from 'vitest';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import {
  INTAKE_STEPS,
  SKIP_DEFAULTS,
  categoriesIn,
  mergeAnswer,
  nextStep,
  readAnswer,
  readFreeText,
  sanitise,
  toProfile,
} from './intake.js';
import { rupees } from './money.js';

const SAMPLE =
  "Riya & Arjun's wedding in Pune on 18 Feb 2027, about 200 guests, budget ₹12 lakh. " +
  'Food and photos matter most. Grandparents are coming, pure veg, traditional.';

describe('Intake: one free-text message fills the whole profile', () => {
  it('reads the sample into a complete, valid profile', () => {
    const draft = readFreeText(SAMPLE, TODAY);
    expect(nextStep(draft)).toBeNull();
    expect(toProfile(draft)).toEqual(weddingProfile());
  });

  it('reads Hinglish answers', () => {
    expect(readFreeText('shaadi hai, 150 log, Jaipur mein, non-veg bhi', TODAY)).toEqual({
      eventType: 'wedding',
      city: 'Jaipur',
      guests: 150,
      diet: 'mixed',
    });
  });

  it('recognises each event type and style', () => {
    expect(readFreeText('Aarav turns 5!', TODAY).eventType).toBe('birthday');
    expect(readFreeText('our 25th anniversary', TODAY).eventType).toBe('anniversary');
    expect(readFreeText('society Ganpati festival', TODAY).eventType).toBe('community');
    expect(readFreeText('keep it eco-friendly and green', TODAY).style).toBe('eco');
    expect(readFreeText('something simple', TODAY).style).toBe('minimal');
    expect(readFreeText('a modern look', TODAY).style).toBe('modern');
    expect(readFreeText('Jain food only', TODAY).diet).toBe('jain');
    expect(readFreeText('wheelchair users and kids', TODAY).audience).toEqual([
      'kids',
      'accessibility',
    ]);
    expect(readFreeText('cousins from abroad', TODAY).audience).toEqual(['outstation']);
  });

  it('takes priorities only from sentences about what matters, in mention order', () => {
    expect(readFreeText('We have a lawn. Photos and food matter most.', TODAY).priorities).toEqual([
      'photography',
      'catering',
    ]);
    expect(readFreeText('We have a lawn and a photographer friend.', TODAY).priorities).toBe(
      undefined,
    );
    expect(categoriesIn('food, photos, decor and music are all important', 'wedding')).toHaveLength(
      3,
    );
    expect(categoriesIn('puja matters', 'birthday')).toEqual([]);
    expect(categoriesIn('puja matters', undefined)).toEqual(['rituals']);
  });
});

describe('Intake: short answers to the question just asked', () => {
  it('accepts bare numbers, names and "none"', () => {
    expect(readAnswer('150', 'guests', TODAY)).toEqual({ guests: 150 });
    expect(readAnswer('5,00,000', 'budgetPaise', TODAY)).toEqual({ budgetPaise: rupees(500_000) });
    expect(readAnswer('Shillong', 'city', TODAY)).toEqual({ city: 'Shillong' });
    expect(readAnswer('Meera turns 60', 'title', TODAY)).toMatchObject({ title: 'Meera turns 60' });
    expect(readAnswer('none', 'audience', TODAY)).toEqual({ audience: [] });
    expect(readAnswer('decor, food', 'priorities', TODAY, 'wedding')).toEqual({
      priorities: ['decor', 'catering'],
    });
  });

  it('prefers a recognised city or title over the raw text', () => {
    expect(readAnswer('in Pune, near FC Road', 'city', TODAY)).toEqual({ city: 'Pune' });
    expect(readAnswer("Riya & Arjun's wedding", 'title', TODAY)).toMatchObject({
      title: "Riya & Arjun's wedding",
    });
  });

  it('ignores answers that are not valid for the question', () => {
    expect(readAnswer('lots', 'guests', TODAY)).toEqual({});
    expect(readAnswer('12', 'budgetPaise', TODAY)).toEqual({});
  });
});

describe('Intake: drafts only keep schema-valid fields', () => {
  it('drops unknown types, impossible counts and past dates', () => {
    expect(
      sanitise(
        { eventType: 'funeral', guests: 0, eventDate: '2026-10-01', city: 'Pune', extra: 'x' },
        TODAY,
      ),
    ).toEqual({ city: 'Pune' });
  });

  it('fills missing fields, and replaces only the one just asked', () => {
    const draft = { guests: 200, city: 'Pune' };
    expect(mergeAnswer(draft, { guests: 250, diet: 'veg' }, null)).toEqual({
      guests: 200,
      city: 'Pune',
      diet: 'veg',
    });
    expect(mergeAnswer(draft, { guests: 250 }, 'guests')).toEqual({ guests: 250, city: 'Pune' });
  });

  it('asks the questions in order and completes with skip defaults', () => {
    expect(nextStep({})).toBe(INTAKE_STEPS[0]);
    const { priorities: _p, audience: _a, diet: _d, style: _s, ...required } = weddingProfile();
    expect(nextStep(required)).toBe('priorities');
    expect(toProfile(required)).toBeNull();
    expect(toProfile({ ...required, ...SKIP_DEFAULTS })).toMatchObject({
      priorities: [],
      audience: [],
      diet: 'mixed',
      style: 'traditional',
    });
  });
});

describe('Intake: audience answers in words', () => {
  it('reads who is coming instead of requiring "none"', () => {
    expect(readAnswer('my grandparents', 'audience', TODAY)).toEqual({ audience: ['elders'] });
  });
});
