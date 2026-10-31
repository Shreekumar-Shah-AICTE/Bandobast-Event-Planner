import { describe, expect, it } from 'vitest';
import { initialInput, buildPlan } from '../domain/plan.js';
import { rupees } from '../domain/money.js';
import { aiDown, aiOk, mockAi, tasksAsked } from '../test/ai.js';
import { CATERER_TEXT, TODAY, weddingProfile } from '../test/fixtures.js';
import { FALLBACK_NOTES } from './client.js';
import { explainOptions, moreIdeas, readChange, readIntake, readQuote } from './readers.js';

const signal = () => new AbortController().signal;
const wire = {
  kind: 'guests',
  mode: 'add',
  value: 50,
  date: null,
  taskId: null,
  evidence: '50 more guests',
};

describe('readChange', () => {
  it('uses the AI changes and reads leftover clauses with the rules', async () => {
    mockAi(() => aiOk({ changes: [wire], unparsed: ['budget down 10%'] }));
    const reading = await readChange(
      '50 more guests, budget down 10%',
      weddingProfile(),
      TODAY,
      signal(),
    );
    expect(reading.source).toBe('ai');
    expect(reading.model).toBe('gemini-test');
    expect(reading.value.changes.map((change) => change.kind)).toEqual(['guests', 'budget']);
  });

  it('falls back to the rules when the AI finds nothing valid', async () => {
    mockAi(() => aiOk({ changes: [{ ...wire, value: null }], unparsed: [] }));
    const reading = await readChange('50 more guests', weddingProfile(), TODAY, signal());
    expect(reading).toMatchObject({ source: 'rules', note: null });
    expect(reading.value.changes).toHaveLength(1);
  });

  it('removes phone numbers and e-mails before sending', async () => {
    const fetchMock = mockAi(() => aiOk({ changes: [wire], unparsed: [] }));
    await readChange(
      '50 more guests, call 98765 43210 or a@b.in',
      weddingProfile(),
      TODAY,
      signal(),
    );
    const sent = JSON.stringify(fetchMock.mock.calls[0]?.[1]?.body);
    expect(sent).toContain('[phone]');
    expect(sent).not.toContain('98765');
    expect(sent).not.toContain('a@b.in');
  });

  it('falls back to the rules, with a note, when the AI is down', async () => {
    const reading = await readChange('50 more guests', weddingProfile(), TODAY, signal());
    expect(reading).toMatchObject({ source: 'rules', note: FALLBACK_NOTES.unavailable });
  });
});

describe('readIntake', () => {
  it('removes phone numbers and e-mails before sending', async () => {
    const fetchMock = mockAi(() => aiDown());
    await readIntake('wedding in Jaipur, 300 guests; call 98765 43210 or a@b.in', TODAY, signal());
    const sent = JSON.stringify(fetchMock.mock.calls[0]?.[1]?.body);
    expect(sent).toContain('[email]');
    expect(sent).not.toContain('98765');
    expect(sent).not.toContain('a@b.in');
  });

  it('lets the AI fill what the rules missed, ignoring empty answers', async () => {
    mockAi(() =>
      aiOk({
        eventType: 'wedding',
        title: "Asha's wedding",
        city: 'Jaipur',
        eventDate: null,
        guests: 300,
        budgetRupees: 1_800_000,
        priorities: ['catering'],
        audience: [],
        diet: 'veg',
        style: null,
      }),
    );
    const reading = await readIntake('wedding in Jaipur, 300 guests, 18 lakh', TODAY, signal());
    expect(reading.source).toBe('ai');
    expect(reading.value).toMatchObject({
      city: 'Jaipur',
      guests: 300,
      budgetPaise: rupees(1_800_000),
    });
    expect(reading.value.audience).toBeUndefined();
  });

  it('falls back to the rules when the AI is down', async () => {
    const reading = await readIntake('birthday for 40 people', TODAY, signal());
    expect(reading.source).toBe('rules');
    expect(reading.value.eventType).toBe('birthday');
  });
});

describe('readQuote', () => {
  const aiQuote = {
    vendorName: 'Shree Ganesh Caterers',
    items: [{ label: 'Veg buffet', unit: 'perGuest', amountRupees: 850, quantity: null }],
    minGuarantee: 250,
    gst: 'extra',
    gstRatePct: 5,
    notes: [],
  };

  it('removes phone numbers and e-mails before sending', async () => {
    const fetchMock = mockAi(() => aiOk(aiQuote));
    const reading = await readQuote(
      `${CATERER_TEXT}\nCall 98765 43210 or a@b.in`,
      'catering',
      signal(),
    );
    expect(reading.source).toBe('ai');
    expect(reading.value.minGuarantee).toBe(250);
    const sent = JSON.stringify(fetchMock.mock.calls[0]?.[1]?.body);
    expect(sent).not.toContain('98765');
    expect(sent).not.toContain('a@b.in');
    expect(reading.text).not.toContain('98765');
  });

  it('uses the rules when the AI returns no items, and when it is down', async () => {
    mockAi(() =>
      aiOk({ ...aiQuote, items: [], minGuarantee: null, gstRatePct: null, vendorName: null }),
    );
    const empty = await readQuote(CATERER_TEXT, 'catering', signal());
    expect(empty).toMatchObject({ source: 'rules', note: null });
    mockAi(() => aiDown());
    const down = await readQuote(CATERER_TEXT, 'catering', signal());
    expect(down).toMatchObject({ source: 'rules', note: FALLBACK_NOTES.unavailable });
    expect(down.value.items.length).toBeGreaterThan(0);
  });
});

describe('moreIdeas', () => {
  it('keeps only AI ideas that pass the checks', async () => {
    const idea = (title: string, description: string) => ({
      title,
      description,
      category: 'decor',
      costLevel: 1,
      tags: ['eco'],
    });
    mockAi(() =>
      aiOk({
        ideas: [
          idea('Marigold and mango-leaf torans', 'Fresh flowers at the gate, composted after.'),
          idea('Call 98765 43210 for lights', 'Lights from our partner shop.'),
        ],
      }),
    );
    const reading = await moreIdeas(weddingProfile(), null, [], signal());
    expect(reading.source).toBe('ai');
    expect(reading.value.map((entry) => entry.title)).toEqual(['Marigold and mango-leaf torans']);
  });

  it('returns no ideas, with a note, when the AI is down', async () => {
    const reading = await moreIdeas(weddingProfile(), 'cheaper', [], signal());
    expect(reading).toMatchObject({ source: 'rules', value: [], note: FALLBACK_NOTES.unavailable });
  });
});

describe('explainOptions', () => {
  const scenarios = buildPlan(
    initialInput(weddingProfile({ budgetPaise: rupees(900_000) })),
    TODAY,
  ).scenarios;

  it('does not call the AI when there is nothing to compare', async () => {
    const fetchMock = mockAi(() => aiDown());
    const reading = await explainOptions([], signal());
    expect(reading.source).toBe('rules');
    expect(tasksAsked(fetchMock)).toEqual([]);
  });

  it('fills every amount from code', async () => {
    const first = scenarios[0];
    if (first === undefined) throw new Error('expected scenarios');
    mockAi(() =>
      aiOk({ text: `{{label:${first.id}}} keeps a reserve of {{reserve:${first.id}}}.` }),
    );
    const reading = await explainOptions(scenarios, signal());
    expect(reading.source).toBe('ai');
    expect(reading.value).toContain(first.label);
    expect(reading.value).not.toContain('{{');
  });

  it('rejects AI text that writes its own numbers', async () => {
    mockAi(() => aiOk({ text: 'Save 50000 rupees by cutting decor.' }));
    const reading = await explainOptions(scenarios, signal());
    expect(reading).toMatchObject({ source: 'rules', note: FALLBACK_NOTES.invalid });
  });

  it('uses the template when the AI is down', async () => {
    const reading = await explainOptions(scenarios, signal());
    expect(reading).toMatchObject({ source: 'rules', note: FALLBACK_NOTES.unavailable });
    expect(reading.value.length).toBeGreaterThan(0);
  });
});
