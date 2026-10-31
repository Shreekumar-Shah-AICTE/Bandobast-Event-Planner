/**
 * Google Calendar template links, Google Maps search links and an .ics export.
 * Links only open Google's own pages; nothing is sent anywhere by this app.
 */
import { addDays, formatDate, type IsoDate } from './dates.js';
import type { ScheduledTask } from './timeline.js';

const compact = (date: IsoDate): string => date.replaceAll('-', '');

/** All-day event details for {@link calendarUrl}. */
export interface CalendarEntry {
  readonly title: string;
  readonly date: IsoDate;
  readonly details: string;
  readonly location: string;
}

/** "Add to Google Calendar" link for an all-day entry. O(n). */
export function calendarUrl(entry: CalendarEntry): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    dates: `${compact(entry.date)}/${compact(addDays(entry.date, 1))}`,
    details: entry.details,
    location: entry.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google Maps search for a kind of vendor in a city (a search, not a recommendation). O(n). */
export function mapsSearchUrl(term: string, city: string): string {
  const params = new URLSearchParams({ api: '1', query: `${term} in ${city}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/** RFC 5545 text escaping. */
const escapeText = (value: string): string =>
  value
    .replace(/\\/gu, '\\\\')
    .replace(/;/gu, '\\;')
    .replace(/,/gu, '\\,')
    .replace(/\r?\n/gu, '\\n');

function vevent(uid: string, date: IsoDate, summary: string, stamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    'END:VEVENT',
  ];
}

/** Parameters for {@link buildIcs}. */
export interface IcsParams {
  readonly title: string;
  readonly eventDate: IsoDate;
  readonly tasks: readonly ScheduledTask[];
  readonly today: IsoDate;
}

/**
 * An .ics calendar with the event day and the due date of every open task.
 * UIDs are stable per task and event date, so re-importing updates entries. O(t).
 */
export function buildIcs(params: IcsParams): string {
  const stamp = `${compact(params.today)}T000000Z`;
  const key = compact(params.eventDate);
  const open = params.tasks.filter((task) => task.status !== 'done');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bandobast//Event plan//EN',
    'CALSCALE:GREGORIAN',
    ...vevent(`event-${key}@bandobast.app`, params.eventDate, params.title, stamp),
    ...open.flatMap((task) =>
      vevent(
        `${task.id}-${key}@bandobast.app`,
        task.due,
        `Due: ${task.title} (${params.title})`,
        stamp,
      ),
    ),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Calendar entry for a task's due date. O(1). */
export function taskCalendarEntry(
  task: ScheduledTask,
  eventTitle: string,
  city: string,
): CalendarEntry {
  return {
    title: `${task.title} — ${eventTitle}`,
    date: task.due,
    details: `Due ${formatDate(task.due)} for ${eventTitle}. Planned with Bandobast.`,
    location: city,
  };
}
