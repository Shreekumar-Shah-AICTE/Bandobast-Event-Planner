import { describe, expect, it } from 'vitest';
import { TODAY } from '../test/fixtures.js';
import { parseChangeText } from './changeParser.js';
import { templateFor } from './templates/index.js';

const TASKS = templateFor('wedding').tasks;
const read = (text: string) => parseChangeText(text, TASKS, TODAY);

describe('Change Test: reading "50 more guests, budget down 10%, event 2 weeks earlier"', () => {
  it('reads the SME sentence into three changes, each with its evidence', () => {
    expect(read('50 more guests, budget down 10%, event 2 weeks earlier')).toEqual({
      changes: [
        { kind: 'guests', mode: 'add', value: 50, evidence: '50 more guests' },
        { kind: 'budget', mode: 'addPct', value: -10, evidence: 'budget down 10%' },
        { kind: 'dateShift', value: -14, evidence: 'event 2 weeks earlier' },
      ],
      unparsed: [],
    });
  });

  it('reads the same request in Hinglish', () => {
    const { changes, unparsed } = read('50 log zyada, budget 10% kam, shaadi 2 hafte pehle');
    expect(changes.map((c) => [c.kind, 'value' in c ? c.value : null])).toEqual([
      ['guests', 50],
      ['budget', -10],
      ['dateShift', -14],
    ]);
    expect(unparsed).toEqual([]);
  });
});

describe('Change Test: other ways people describe changes', () => {
  it.each([
    ['guests to 300', { kind: 'guests', mode: 'set', value: 300 }],
    ['30 fewer guests', { kind: 'guests', mode: 'add', value: -30 }],
    ['guest count 180', { kind: 'guests', mode: 'set', value: 180 }],
    ['budget increased to ₹15 lakh', { kind: 'budget', mode: 'set', value: 1_500_000 }],
    ['add ₹50,000 to the budget', { kind: 'budget', mode: 'add', value: 50_000 }],
    ['budget cut by Rs 1 lakh', { kind: 'budget', mode: 'add', value: -100_000 }],
    ['budget up 5%', { kind: 'budget', mode: 'addPct', value: 5 }],
    ['postpone by 1 month', { kind: 'dateShift', value: 30 }],
    ['prepone the wedding by ten days', { kind: 'dateShift', value: -10 }],
    ['event 3 days later', { kind: 'dateShift', value: 3 }],
    ['move the wedding to 20 March 2027', { kind: 'dateSet', date: '2027-03-20' }],
    ['caterer delayed by 5 days', { kind: 'taskDelay', taskId: 'caterer', value: 5 }],
    ['photographer is running 1 week late', { kind: 'taskDelay', taskId: 'photo', value: 7 }],
    ['venue booked', { kind: 'taskDone', taskId: 'venue' }],
    ['invitations sent', { kind: 'taskDone', taskId: 'invites' }],
  ])('"%s"', (text, expected) => {
    const { changes, unparsed } = read(text);
    expect(unparsed).toEqual([]);
    expect(changes).toEqual([{ ...expected, evidence: text }]);
  });

  it('keeps clauses it cannot read for the user to confirm', () => {
    expect(read('make it more fun and 20 more guests')).toEqual({
      changes: [{ kind: 'guests', mode: 'add', value: 20, evidence: '20 more guests' }],
      unparsed: ['make it more fun'],
    });
    expect(read('budget is a worry').changes).toEqual([]);
    expect(read('venue is lovely').changes).toEqual([]);
  });

  it('does not split amounts written with Indian commas', () => {
    expect(read('budget down by ₹1,50,000').changes).toEqual([
      { kind: 'budget', mode: 'add', value: -150_000, evidence: 'budget down by ₹1,50,000' },
    ]);
  });

  it('caps a request at six changes and 300 characters', () => {
    const many = Array.from({ length: 9 }, (_, i) => `${String(i + 1)} more guests`).join(', ');
    expect(read(many).changes).toHaveLength(6);
    expect(read(`${'x '.repeat(160)}, 50 more guests`).changes).toEqual([]);
  });
});

describe('Change Test: edge cases the reader must not guess', () => {
  it('prefers the longest task keyword and ignores zero-day delays', () => {
    expect(read('photo/video team delayed by 3 days').changes).toEqual([
      {
        kind: 'taskDelay',
        taskId: 'photo',
        value: 3,
        evidence: 'photo/video team delayed by 3 days',
      },
    ]);
    expect(read('caterer delayed by 0 days')).toEqual({
      changes: [],
      unparsed: ['caterer delayed by 0 days'],
    });
  });

  it('needs a direction for a budget percentage', () => {
    expect(read('budget 10%')).toEqual({ changes: [], unparsed: ['budget 10%'] });
  });
});
