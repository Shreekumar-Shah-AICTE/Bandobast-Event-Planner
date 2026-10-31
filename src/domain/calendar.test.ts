import { describe, expect, it } from 'vitest';
import { TODAY } from '../test/fixtures.js';
import { buildIcs, calendarUrl, mapsSearchUrl, taskCalendarEntry } from './calendar.js';
import { templateFor } from './templates/index.js';
import { schedule } from './timeline.js';

const tasks = schedule({
  tasks: templateFor('wedding').tasks,
  states: { venue: { done: true, doneOn: TODAY, delayDays: 0, compressed: false } },
  eventDate: '2027-02-18',
  today: TODAY,
}).tasks;

describe('Timeline: calendar and maps links', () => {
  it('builds an all-day Google Calendar link', () => {
    const url = new URL(
      calendarUrl({
        title: 'Book venue',
        date: '2027-01-20',
        details: 'Due soon',
        location: 'Pune',
      }),
    );
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20270120/20270121');
    expect(url.searchParams.get('location')).toBe('Pune');
  });

  it('builds a Google Maps search, not a recommendation', () => {
    const url = new URL(mapsSearchUrl('wedding caterers', 'Pune'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('query')).toBe('wedding caterers in Pune');
  });

  it('describes a task due date for the calendar', () => {
    const caterer = tasks.find((t) => t.id === 'caterer')!;
    expect(taskCalendarEntry(caterer, "Riya & Arjun's wedding", 'Pune')).toMatchObject({
      date: caterer.due,
      location: 'Pune',
      details: expect.stringContaining('Planned with Bandobast') as string,
    });
  });
});

describe('Timeline: .ics export', () => {
  const ics = buildIcs({
    title: 'Riya, Arjun; wedding',
    eventDate: '2027-02-18',
    tasks,
    today: TODAY,
  });
  const lines = ics.split('\r\n');

  it('is a valid calendar with CRLF lines and stable UIDs', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('PRODID:-//Bandobast//Event plan//EN');
    expect(lines).toContain('UID:event-20270218@bandobast.app');
    expect(lines).toContain('UID:caterer-20270218@bandobast.app');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('escapes commas and semicolons and skips done tasks', () => {
    expect(lines).toContain('SUMMARY:Riya\\, Arjun\\; wedding');
    expect(lines.some((line) => line.startsWith('UID:venue-'))).toBe(false);
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(tasks.length);
  });
});
