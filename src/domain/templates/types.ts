import type { CategoryId, EventType } from '../../../shared/schemas.js';

/** Typical mid-range cost in rupees (assumption): `fixed + perGuest × guests`. */
export interface CostModel {
  readonly fixed: number;
  readonly perGuest: number;
}

export interface CategoryTemplate {
  readonly id: CategoryId;
  readonly cost: CostModel;
}

export interface TaskTemplate {
  readonly id: string;
  readonly title: string;
  readonly category?: CategoryId;
  /** Due this many days before the event (negative = after it). */
  readonly leadDays: number;
  readonly durationDays: number;
  /** Shortest realistic duration when the plan must be compressed. */
  readonly minDurationDays: number;
  readonly dependsOn: readonly string[];
  /** Words that identify the task in change requests ("caterer delayed by 5 days"). */
  readonly keywords: readonly string[];
  /** How to compress it when time runs short. */
  readonly tip?: string;
  /** Added by the user: scheduled the same way, but never on the critical path. */
  readonly custom?: boolean;
}

/** A way to change the event's format that lowers typical costs (multipliers are assumptions). */
export interface FormatOption {
  readonly id: string;
  readonly label: string;
  readonly effects: Readonly<Partial<Record<CategoryId, number>>>;
  /** How much the change asks of the hosts, on the same scale as a full cut of one ordinary line. */
  readonly compromise: number;
}

export interface EventTemplate {
  readonly eventType: EventType;
  readonly label: string;
  /** Share of the budget kept aside for surprises (assumption). */
  readonly contingencyPct: number;
  readonly categories: readonly CategoryTemplate[];
  readonly tasks: readonly TaskTemplate[];
  readonly formats: readonly FormatOption[];
}
