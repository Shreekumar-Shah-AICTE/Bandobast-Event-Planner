import { describe, expect, it } from 'vitest';
import { TODAY, weddingProfile } from '../test/fixtures.js';
import { addVersion, firstVersion } from './plan.js';
import { STORAGE_KEY, deserialise, planFileName, serialise } from './storage.js';

const first = firstVersion(weddingProfile(), TODAY);
const history = addVersion([first], { input: first.input, label: 'More guests', today: TODAY });

describe('History: saved plans load back exactly, or not at all', () => {
  it('round-trips the version history under a versioned key', () => {
    expect(STORAGE_KEY).toBe('bandobast.plan.v1');
    expect(deserialise(serialise(history, 2))).toEqual({
      ok: true,
      value: { schemaVersion: 1, versions: history, current: 2 },
    });
  });

  it('reports empty, corrupt and newer data instead of guessing', () => {
    expect(deserialise(null)).toEqual({ ok: false, error: 'empty' });
    expect(deserialise('  ')).toEqual({ ok: false, error: 'empty' });
    expect(deserialise('{not json')).toEqual({ ok: false, error: 'corrupt' });
    expect(deserialise(JSON.stringify({ schemaVersion: 2, versions: [] }))).toEqual({
      ok: false,
      error: 'unsupported',
    });
    expect(deserialise(serialise(history, 9))).toEqual({ ok: false, error: 'corrupt' });
    const tampered = JSON.parse(serialise(history, 1)) as {
      versions: { input: { profile: { guests: number } } }[];
    };
    tampered.versions[0]!.input.profile.guests = -5;
    expect(deserialise(JSON.stringify(tampered))).toEqual({ ok: false, error: 'corrupt' });
  });

  it('names plan files after the plan, safely', () => {
    expect(planFileName("Riya & Arjun's wedding")).toBe('bandobast-riya-arjun-s-wedding.json');
    expect(planFileName('शादी')).toBe('bandobast-plan.json');
    expect(planFileName(`${'a'.repeat(39)} b`)).toBe(`bandobast-${'a'.repeat(39)}.json`);
  });

  it('loads plans saved before payments and custom tasks existed', () => {
    const old = serialise([first], 1)
      .replace(',"payments":[]', '')
      .replace(',"customTasks":[]', '');
    expect(old).not.toMatch(/payments|customTasks/u);
    expect(deserialise(old)).toEqual({
      ok: true,
      value: { schemaVersion: 1, versions: [first], current: 1 },
    });
  });
});
