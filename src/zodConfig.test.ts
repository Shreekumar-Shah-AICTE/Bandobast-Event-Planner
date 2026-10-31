import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import './zodConfig.js';

describe('zod config for the browser', () => {
  it('turns off the eval-based fast path that the CSP forbids', () => {
    expect(z.config().jitless).toBe(true);
  });
});
