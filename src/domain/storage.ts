/**
 * Persisted state: plan versions in localStorage, validated with zod on every
 * load. Unknown or newer schema versions are rejected instead of guessed at.
 */
import { z } from 'zod';
import { LIMITS } from '../../shared/limits.js';
import { PlanVersionSchema, type PlanVersion } from '../../shared/schemas.js';
import { err, ok, type Result } from './result.js';

export const STORAGE_KEY = 'bandobast.plan.v1';
export const SCHEMA_VERSION = 1;

export const PersistedSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  versions: z.array(PlanVersionSchema).min(1).max(LIMITS.maxVersions),
  current: z.int().min(1),
});
export type Persisted = z.infer<typeof PersistedSchema>;

export type LoadError = 'empty' | 'corrupt' | 'unsupported';

/** Serialises the history (JSON). O(n). */
export const serialise = (versions: readonly PlanVersion[], current: number): string =>
  JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    versions: [...versions],
    current,
  } satisfies Persisted);

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Parses stored text; `current` must name an existing version. O(n). */
export function deserialise(raw: string | null): Result<Persisted, LoadError> {
  if (raw === null || raw.trim() === '') return err('empty');
  const data = parseJson(raw);
  const version = z.object({ schemaVersion: z.number() }).safeParse(data);
  if (version.success && version.data.schemaVersion !== SCHEMA_VERSION) return err('unsupported');
  const parsed = PersistedSchema.safeParse(data);
  if (!parsed.success) return err('corrupt');
  const exists = parsed.data.versions.some((entry) => entry.version === parsed.data.current);
  return exists ? ok(parsed.data) : err('corrupt');
}
