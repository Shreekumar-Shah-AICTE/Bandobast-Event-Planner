import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../domain/storage.js';
import { weddingProfile, TODAY } from '../test/fixtures.js';
import { quotaExceeded, storageWith } from '../test/storage.js';
import { chooseStorage, memoryStorage } from './browserStorage.js';
import { BACKUP_KEY, loadPlan, savePlan } from './persistence.js';
import { EMPTY_STATE, planReducer } from './planState.js';

const planned = () =>
  planReducer(EMPTY_STATE, { type: 'start', profile: weddingProfile(), today: TODAY });

const failing = (base: Storage): Storage =>
  storageWith(base, {
    setItem: quotaExceeded,
    removeItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  });

describe('loadPlan and savePlan', () => {
  it('round-trips a plan and reports no problem', () => {
    const storage = memoryStorage();
    expect(savePlan(storage, planned())).toBe(true);
    const loaded = loadPlan(storage);
    expect(loaded.problem).toBeNull();
    expect(loaded.state.current).toBe(1);
    expect(loaded.state.report).toBeNull();
  });

  it('starts empty with no problem when nothing is saved', () => {
    expect(loadPlan(memoryStorage())).toEqual({ state: EMPTY_STATE, problem: null });
  });

  it('keeps an unreadable save aside instead of overwriting it', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const loaded = loadPlan(storage);
    expect(loaded.problem).toBe('corrupt');
    expect(storage.getItem(BACKUP_KEY)).toBe('{not json');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('says when a save comes from a newer version', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, versions: [], current: 1 }));
    expect(loadPlan(storage).problem).toBe('unsupported');
  });

  it('leaves the save in place when it cannot be moved aside', () => {
    const base = memoryStorage();
    base.setItem(STORAGE_KEY, '{not json');
    expect(loadPlan(failing(base)).problem).toBe('corrupt');
    expect(base.getItem(STORAGE_KEY)).toBe('{not json');
  });

  it('removes the save when the plan is emptied, and reports refused writes', () => {
    const storage = memoryStorage();
    savePlan(storage, planned());
    expect(savePlan(storage, EMPTY_STATE)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(savePlan(failing(memoryStorage()), planned())).toBe(false);
  });
});

describe('chooseStorage', () => {
  it('uses the browser storage when it works', () => {
    const storage = memoryStorage();
    expect(chooseStorage(() => storage)).toEqual({ storage, persistent: true });
  });

  it('falls back to memory when the browser blocks storage', () => {
    const choice = chooseStorage(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(choice.persistent).toBe(false);
    choice.storage.setItem('a', '1');
    expect(choice.storage.length).toBe(1);
    expect(choice.storage.key(0)).toBe('a');
    expect(choice.storage.key(1)).toBeNull();
    choice.storage.removeItem('a');
    expect(choice.storage.getItem('a')).toBeNull();
    choice.storage.setItem('b', '2');
    choice.storage.clear();
    expect(choice.storage.length).toBe(0);
  });
});
