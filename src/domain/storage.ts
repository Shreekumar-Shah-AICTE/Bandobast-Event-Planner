/**
 * Persisted state: plan versions in localStorage or in a plan file, validated
 * with zod on every load. Unknown or newer schema versions are rejected instead
 * of guessed at.
 */
import { z } from 'zod';
import { LIMITS } from '../../shared/limits.js';
import { PlanVersionSchema, type PlanVersion } from '../../shared/schemas.js';
import { err, ok, type Result } from './result.js';

/** The `localStorage` key for the saved plan. */
export const STORAGE_KEY = 'bandobast.plan.v1';
/** Version of the saved format. A save from a newer format is set aside, not guessed at. */
export const SCHEMA_VERSION = 1;

/** The saved history: the format version, the versions and the one on screen. */
export const PersistedSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  versions: z.array(PlanVersionSchema).min(1).max(LIMITS.maxVersions),
  current: z.int().min(1),
});
/** A saved history that passed its schema. */
export type Persisted = z.infer<typeof PersistedSchema>;

/**
 * Why no saved plan was loaded: there is none, it is unreadable, or it comes from a newer format.
 */
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

/** Largest plan file accepted; a full history of the largest plan is far smaller. */
export const MAX_PLAN_FILE_BYTES = 2_000_000;

const MAX_SLUG = 40;

/** "bandobast-riya-arjun-s-wedding.json"; titles with no Latin letters give "bandobast-plan.json". O(n). */
export function planFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gu, '-')
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/gu, '');
  return `bandobast-${slug === '' ? 'plan' : slug}.json`;
}
