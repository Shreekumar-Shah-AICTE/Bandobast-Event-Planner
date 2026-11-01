/** Plan-input edits for one budget line: your own number, or back to the estimate. */
import type { CategoryId, PlanInput } from '../../../shared/schemas.js';
import type { Paise } from '../../domain/money.js';

export const withUserAmount = (
  input: PlanInput,
  category: CategoryId,
  amountPaise: Paise,
): PlanInput => ({
  ...input,
  overrides: { ...input.overrides, [category]: { kind: 'user', amountPaise } },
});

export function withEstimate(input: PlanInput, category: CategoryId): PlanInput {
  const { [category]: _removed, ...overrides } = input.overrides;
  return { ...input, overrides };
}
