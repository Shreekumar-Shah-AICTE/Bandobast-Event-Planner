/** What every plan screen needs: the derived plan, today, and the two ways to change it. */
import type { PlanInput } from '../../../shared/schemas.js';
import type { IsoDate } from '../../domain/dates.js';
import type { Plan } from '../../domain/plan.js';

export interface PlanControls {
  readonly plan: Plan;
  readonly today: IsoDate;
  /** Saves a new version, listed in History. */
  readonly commit: (input: PlanInput, label: string) => void;
  /** Updates the version on screen in place (ticks, statuses, report actions). */
  readonly edit: (input: PlanInput) => void;
}
