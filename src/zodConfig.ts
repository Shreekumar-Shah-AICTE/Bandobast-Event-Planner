/**
 * Imported first by main.tsx, before any schema is built. The CSP has no 'unsafe-eval', so zod
 * must not probe for, or use, its eval-based fast path (it decides when each object schema is made).
 */
import { z } from 'zod';

z.config({ jitless: true });
