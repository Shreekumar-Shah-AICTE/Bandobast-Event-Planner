/** Small text helpers for the screens. */
import { EVENT_TYPES, type CostLevel, type EventType } from '../../../shared/schemas.js';
import { templateFor } from '../../domain/templates/index.js';

export const EVENT_LABELS = Object.fromEntries(
  EVENT_TYPES.map((type) => [type, templateFor(type).label]),
) as Readonly<Record<EventType, string>>;

/** "1 day", "5 days". */
export const plural = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** First letter upper-cased: "vegetarian" → "Vegetarian". */
export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const COST_WORDS: Readonly<Record<CostLevel, string>> = { 1: 'low', 2: 'medium', 3: 'high' };

/** Cost level as ₹ signs plus words for screen readers. */
export const costText = (level: CostLevel): { readonly signs: string; readonly words: string } => ({
  signs: '₹'.repeat(level),
  words: `${COST_WORDS[level]} cost`,
});

/** Lower-case words joined for a sentence: "a, b and c". */
export function listText(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}
