import { describe, expect, it } from 'vitest';
import { weddingProfile } from '../test/fixtures.js';
import { buildBudget, type BudgetParams } from './budget.js';
import { explainScenarios, fillPlaceholders, scenarioPlaceholders } from './explain.js';
import { rupees } from './money.js';
import { buildScenarios } from './scenarios.js';
import { templateFor } from './templates/index.js';

const params: BudgetParams = {
  total: rupees(1_080_000),
  guests: 250,
  cityFactor: 1,
  template: templateFor('wedding'),
  priorities: weddingProfile().priorities,
  settings: { strategy: 'balanced', formats: [], useContingency: false },
  fixed: {},
};
const scenarios = buildScenarios(params, buildBudget(params));
const values = scenarioPlaceholders(scenarios);

describe('Budget: scenario explanations never carry model-written numbers', () => {
  it('offers labels, impact, reserve and per-line cuts as placeholders', () => {
    expect(values['label:protect']).toBe('Protect your priorities');
    expect(values['impact:format']).toBe('high');
    expect(values['reserve:share']).toBe('₹86,400');
    expect(values['cut:protect:venue']).toMatch(/^₹/u);
    expect(values['cut:protect:catering']).toBeUndefined();
  });

  it('fills known placeholders and rejects digits or unknown keys', () => {
    expect(fillPlaceholders('{{label:protect}} keeps food whole.', values)).toEqual({
      ok: true,
      value: 'Protect your priorities keeps food whole.',
    });
    expect(fillPlaceholders('Saves 40,000 on decor.', values)).toEqual({
      ok: false,
      error: 'digits',
    });
    expect(fillPlaceholders('{{cut:protect:cake}} on cake.', values)).toEqual({
      ok: false,
      error: 'unknown',
    });
    expect(fillPlaceholders('Odd {{ brace', values)).toEqual({ ok: false, error: 'unknown' });
  });

  it('falls back to a template sentence built from the scenarios', () => {
    const text = explainScenarios(scenarios);
    expect(
      text.startsWith('Protect your priorities has the least impact on your priorities (medium).'),
    ).toBe(true);
    expect(text).toContain('The biggest cut is');
    expect(text).toContain('Change the format: high impact.');
    expect(explainScenarios([])).toBe(
      'Your budget covers typical costs, so no rebalancing is needed.',
    );
  });
});

describe('Budget: explanation when the best option cuts nothing', () => {
  it('skips the biggest-cut sentence', () => {
    const small: BudgetParams = { ...params, guests: 200, total: rupees(1_100_000) };
    const reserve = buildScenarios(small, buildBudget(small)).find((s) => s.id === 'contingency')!;
    expect(explainScenarios([reserve])).not.toContain('biggest cut');
  });
});
