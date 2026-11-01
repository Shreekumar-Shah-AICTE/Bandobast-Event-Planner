/**
 * Rule-based reader for change requests in English and everyday Hinglish
 * ("50 more guests, budget down 10%, event 2 weeks earlier", "50 log zyada,
 * budget 10% kam, shaadi 2 hafte pehle"). Used when the AI is unavailable and to
 * cross-check it. Every change keeps the clause it came from as evidence.
 */
import type { Change } from '../../shared/schemas.js';
import { LIMITS } from '../../shared/limits.js';
import { DAYS_PER_MONTH, DAYS_PER_WEEK, NUMBER_WORDS } from './constants.js';
import { parseDateText, type IsoDate } from './dates.js';
import { parseMoney, toRupees } from './money.js';
import type { TaskTemplate } from './templates/index.js';
import { at } from './access.js';

/** What the rule-based reader understood, and the clauses it could not read. */
export interface ParsedChanges {
  readonly changes: readonly Change[];
  /** Clauses the rules could not read. */
  readonly unparsed: readonly string[];
}

const NUM = String.raw`(\d{1,4}|${Object.keys(NUMBER_WORDS).join('|')})`;
const GUEST = String.raw`(?:guests?|people|persons|pax|log|logon|mehmaan|mehman|invitees|attendees)`;
const UNIT = String.raw`(days?|din|weeks?|hafte|hafta|months?|mahine|mahina)`;
const CLAUSE_SPLIT = new RegExp(
  String.raw`,(?!\d{2})|;|(?<!\b(?:rs|no|approx))\.\s+|\s+(?:and|also|then|plus)\s+|\s+aur\s+(?!${GUEST}\b)`,
  'iu',
);
const GUEST_COUNT = new RegExp(
  String.raw`${NUM}\s*(?:more|extra|additional|aur|zyada|jyada|fewer|less|kam)?\s*${GUEST}\b`,
  'iu',
);
const GUEST_FIRST = new RegExp(
  String.raw`\b${GUEST}\s*(?:count\s*)?(?:\w+\s+)?(?:by|to|=|:)?\s*${NUM}\b`,
  'iu',
);
const MORE = /\b(more|extra|additional|add|plus|increase|up|aur|zyada|jyada|badh\w*)\b|\+/iu;
const LESS = /\b(fewer|less|kam|reduce\w*|cut|down|ghat\w*|decrease\w*|lower\w*|drop\w*|minus)\b/iu;
/** "guests to 300", "budget increased to ₹15 lakh": an absolute target, not a step. */
const SET_TO = /(\bto\b|=|:)\s*(₹|rs\.?|\d)/iu;
const PCT = /(\d{1,2}(?:\.\d)?)\s*(?:%|percent|per cent)/iu;
const SHIFT = new RegExp(
  String.raw`${NUM}\s*${UNIT}\s*(earlier|sooner|before|pehle|jaldi|later|after|baad|aage)`,
  'iu',
);
const SHIFT_VERB = new RegExp(
  String.raw`(prepone|bring forward|advance|postpone|push)\w*.*?${NUM}\s*${UNIT}`,
  'iu',
);
/** Capture groups of SHIFT ("2 weeks earlier") and SHIFT_VERB ("postpone by 2 weeks"). */
const SHIFT_GROUP = { count: 1, unit: 2, direction: 3 } as const;
const VERB_GROUP = { verb: 1, count: 2, unit: 3 } as const;
const EARLIER = /^(earlier|sooner|before|pehle|jaldi|prepone|bring forward|advance)/iu;
const EVENT_WORD = /\b(date|event|wedding|shaadi|party|function|celebration|it)\b/iu;
const DELAY = /\b(delay\w*|late|slip\w*|push\w*|der|longer|extra)\b/iu;
const DONE = /\b(done|booked|finished|completed|sent|confirmed|ordered|fixed|ho gaya|hogaya)\b/iu;

const toNumber = (token: string | undefined): number =>
  token === undefined ? Number.NaN : (NUMBER_WORDS[token.toLowerCase()] ?? Number(token));

function daysOf(count: string, unit: string): number {
  const u = unit.toLowerCase();
  const weeks = u.startsWith('w') || u.startsWith('h');
  const perUnit = weeks ? DAYS_PER_WEEK : u.startsWith('m') ? DAYS_PER_MONTH : 1;
  return toNumber(count) * perUnit;
}

function direction(clause: string): -1 | 0 | 1 {
  if (LESS.test(clause)) return -1;
  return MORE.test(clause) ? 1 : 0;
}

function guestChange(clause: string): Change | null {
  const match = GUEST_COUNT.exec(clause) ?? GUEST_FIRST.exec(clause);
  const value = toNumber(match?.[1]);
  if (!Number.isInteger(value) || value <= 0) return null;
  const sign = direction(clause);
  if (sign === 0 || SET_TO.test(clause))
    return { kind: 'guests', mode: 'set', value, evidence: clause };
  return { kind: 'guests', mode: 'add', value: sign * value, evidence: clause };
}

function budgetChange(clause: string): Change | null {
  if (!/\bbudget\b/iu.test(clause)) return null;
  const sign = direction(clause);
  const pct = PCT.exec(clause);
  if (pct)
    return sign === 0
      ? null
      : { kind: 'budget', mode: 'addPct', value: sign * Number(pct[1]), evidence: clause };
  const amount = parseMoney(clause);
  if (amount === null) return null;
  if (sign === 0 || SET_TO.test(clause)) {
    return { kind: 'budget', mode: 'set', value: toRupees(amount), evidence: clause };
  }
  return { kind: 'budget', mode: 'add', value: sign * toRupees(amount), evidence: clause };
}

function shiftChange(clause: string): Change | null {
  const shift = SHIFT.exec(clause);
  if (shift) {
    const days = daysOf(at(shift, SHIFT_GROUP.count), at(shift, SHIFT_GROUP.unit));
    return {
      kind: 'dateShift',
      value: EARLIER.test(at(shift, SHIFT_GROUP.direction)) ? -days : days,
      evidence: clause,
    };
  }
  const verb = SHIFT_VERB.exec(clause);
  if (verb === null) return null;
  const days = daysOf(at(verb, VERB_GROUP.count), at(verb, VERB_GROUP.unit));
  return {
    kind: 'dateShift',
    value: EARLIER.test(at(verb, VERB_GROUP.verb)) ? -days : days,
    evidence: clause,
  };
}

function dateChange(clause: string, today: IsoDate): Change | null {
  const shift = shiftChange(clause);
  if (shift !== null) return shift;
  const date = EVENT_WORD.test(clause) ? parseDateText(clause, today) : null;
  return date === null ? null : { kind: 'dateSet', date, evidence: clause };
}

function findTask(clause: string, tasks: readonly TaskTemplate[]): TaskTemplate | null {
  const lower = clause.toLowerCase();
  const hits = tasks.flatMap((task) =>
    task.keywords
      .filter((word) => new RegExp(String.raw`\b${word}\b`, 'iu').test(lower))
      .map((word) => ({ task, length: word.length })),
  );
  return hits.sort((a, b) => b.length - a.length)[0]?.task ?? null;
}

function taskChange(clause: string, tasks: readonly TaskTemplate[]): Change | null {
  const task = findTask(clause, tasks);
  if (task === null) return null;
  const late = new RegExp(String.raw`${NUM}\s*${UNIT}`, 'iu').exec(clause);
  if (late && DELAY.test(clause)) {
    const days = Math.min(LIMITS.maxDelayDays, daysOf(at(late, 1), at(late, 2)));
    return days > 0 ? { kind: 'taskDelay', taskId: task.id, value: days, evidence: clause } : null;
  }
  return DONE.test(clause) ? { kind: 'taskDone', taskId: task.id, evidence: clause } : null;
}

function readClause(clause: string, tasks: readonly TaskTemplate[], today: IsoDate): Change | null {
  return (
    taskChange(clause, tasks) ??
    budgetChange(clause) ??
    dateChange(clause, today) ??
    guestChange(clause)
  );
}

/** Splits `text` into clauses and reads each one. O(k · t) for k clauses and t task keywords. */
export function parseChangeText(
  text: string,
  tasks: readonly TaskTemplate[],
  today: IsoDate,
): ParsedChanges {
  const clauses = text
    .slice(0, LIMITS.maxChangeTextLength)
    .split(CLAUSE_SPLIT)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
  const changes: Change[] = [];
  const unparsed: string[] = [];
  for (const clause of clauses) {
    const change = readClause(clause, tasks, today);
    if (change === null) unparsed.push(clause);
    else changes.push(change);
  }
  return { changes: changes.slice(0, LIMITS.maxChanges), unparsed };
}
