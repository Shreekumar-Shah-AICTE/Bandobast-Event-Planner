import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { aiDown, mockAi } from './ai.js';

beforeEach(() => {
  // No test reaches the network: the AI is "down" unless a test says otherwise.
  mockAi(() => aiDown());
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
