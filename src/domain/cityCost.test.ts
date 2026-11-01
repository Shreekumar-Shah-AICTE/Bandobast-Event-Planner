import { describe, expect, it } from 'vitest';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import { cityClass, cityCostFactor, describeCityPricing } from './cityCost.js';
import { rupees } from './money.js';
import { buildPlan, initialInput } from './plan.js';

describe('City prices: estimates follow the X/Y/Z city classes', () => {
  it('knows metros, their suburbs, old names and large cities; anything else is a smaller town', () => {
    expect(
      ['Mumbai', 'Navi Mumbai, Maharashtra', 'Gurgaon', 'Bangalore', 'Pune'].map(cityClass),
    ).toEqual(['X', 'X', 'X', 'X', 'X']);
    expect(['Jaipur', ' indore ', 'Vizag', 'Kochi City'].map(cityClass)).toEqual([
      'Y',
      'Y',
      'Y',
      'Y',
    ]);
    expect(cityClass('Shillong')).toBe('Z');
    expect(cityClass('  ')).toBeNull();
  });

  it('scales metro prices by 1, 0.85 and 0.7, and keeps metro prices when no city is given', () => {
    expect(['Delhi', 'Lucknow', 'Hosur', ''].map(cityCostFactor)).toEqual([1, 0.85, 0.7, 1]);
  });

  it('says how the estimates were priced', () => {
    expect(describeCityPricing('Pune')).toBe('at metro prices for Pune');
    expect(describeCityPricing('Jaipur, Rajasthan')).toBe(
      'for Jaipur, a large city: about 15% below metro prices',
    );
    expect(describeCityPricing('Hosur')).toBe(
      'for Hosur, a smaller city or town: about 30% below metro prices',
    );
    expect(describeCityPricing('')).toBe('at metro prices (no city given)');
  });

  it('lowers only the estimates: your own numbers stay exactly as typed', () => {
    const metro = initialInput(weddingProfile());
    const town = initialInput(weddingProfile({ city: 'Jaipur' }));
    const typical = (input: typeof metro) =>
      buildPlan(input, TODAY).budget.lines.map((line) => line.typical);
    const metroTypical = typical(metro);
    typical(town).forEach((amount, index) => {
      // Whole-rupee rounding: within one rupee (100 paise) of 85% of the metro price.
      expect(Math.abs(amount - (metroTypical[index] ?? 0) * 0.85)).toBeLessThanOrEqual(100);
    });
    const own = {
      ...town,
      overrides: { catering: { kind: 'user' as const, amountPaise: rupees(300_000) } },
    };
    const catering = buildPlan(own, TODAY).budget.lines.find(
      (line) => line.category === 'catering',
    );
    expect(catering).toMatchObject({ planned: rupees(300_000), provenance: 'user' });
  });
});
