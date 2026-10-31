import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayIso } from './today.js';

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the device's local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 23, 30));
    expect(todayIso()).toBe('2026-11-01');
  });
});
