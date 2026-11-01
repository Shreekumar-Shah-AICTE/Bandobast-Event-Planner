import type { EventType } from '../../../shared/schemas.js';
import { ANNIVERSARY } from './anniversary.js';
import { BIRTHDAY } from './birthday.js';
import { COMMUNITY } from './community.js';
import type { EventTemplate } from './types.js';
import { WEDDING } from './wedding.js';

export type {
  CategoryTemplate,
  CostModel,
  EventTemplate,
  FormatOption,
  TaskTemplate,
} from './types.js';

const TEMPLATES: Readonly<Record<EventType, EventTemplate>> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  anniversary: ANNIVERSARY,
  community: COMMUNITY,
};

/** The planning template for an event type. O(1). */
export const templateFor = (eventType: EventType): EventTemplate => TEMPLATES[eventType];
