/**
 * Plain-language comparison of rebalance scenarios. The AI may write the prose,
 * but only with {{placeholders}}; code fills every number, and text with digits
 * or unknown placeholders is rejected in favour of the template sentence below.
 */
import { CATEGORIES } from './catalog.js';
import { formatCompact } from './money.js';
import { err, ok, type Result } from './result.js';
import type { Scenario } from './scenarios.js';

export type Placeholders = Readonly<Record<string, string>>;

const PLACEHOLDER_RE = /\{\{([a-z]+(?::[a-z-]+){1,2})\}\}/gu;

/** Every value an explanation may cite, keyed like `cut:protect:decor`. O(s · c). */
export function scenarioPlaceholders(scenarios: readonly Scenario[]): Placeholders {
  const entries = scenarios.flatMap((scenario) => [
    [`label:${scenario.id}`, scenario.label],
    [`impact:${scenario.id}`, scenario.painLevel],
    [`reserve:${scenario.id}`, formatCompact(scenario.budget.contingency)],
    ...scenario.budget.lines
      .filter((line) => line.provenance === 'estimate' && line.planned < line.typical)
      .map((line) => [
        `cut:${scenario.id}:${line.category}`,
        formatCompact(line.typical - line.planned),
      ]),
  ]);
  return Object.fromEntries(entries) as Placeholders;
}

/** Replaces placeholders with values; rejects digits written by the model and unknown keys. O(n). */
export function fillPlaceholders(
  text: string,
  values: Placeholders,
): Result<string, 'digits' | 'unknown'> {
  const outside = text.replace(PLACEHOLDER_RE, '');
  if (/\d/u.test(outside)) return err('digits');
  if (/\{\{|\}\}/u.test(outside)) return err('unknown');
  const keys = [...text.matchAll(PLACEHOLDER_RE)].map((match) => match[1] ?? '');
  if (keys.some((key) => values[key] === undefined)) return err('unknown');
  return ok(text.replace(PLACEHOLDER_RE, (_match, key: string) => values[key] ?? ''));
}

function biggestCut(scenario: Scenario): string | null {
  const cuts = scenario.budget.lines
    .filter((line) => line.provenance === 'estimate' && line.planned < line.typical)
    .map((line) => ({ label: CATEGORIES[line.category].label, cut: line.typical - line.planned }))
    .sort((a, b) => b.cut - a.cut);
  const top = cuts[0];
  return top === undefined
    ? null
    : `The biggest cut is ${top.label}, ${formatCompact(top.cut)} below typical.`;
}

/** Template explanation used when the AI is unavailable or its text fails the checks. O(s · c). */
export function explainScenarios(scenarios: readonly Scenario[]): string {
  const [best, ...rest] = scenarios;
  if (best === undefined) return 'Your budget covers typical costs, so no rebalancing is needed.';
  return [
    `${best.label} has the least impact on your priorities (${best.painLevel}). ${best.description}`,
    biggestCut(best),
    ...rest.map((scenario) => `${scenario.label}: ${scenario.painLevel} impact.`),
  ]
    .filter((sentence): sentence is string => sentence !== null)
    .join(' ');
}
