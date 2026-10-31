/** JSON responses with security headers, and the error shape the client understands. */
import type { AiError } from '../shared/aiContracts.js';

/** HTTP status codes used by the AI function. */
export const STATUS = {
  ok: 200,
  badRequest: 400,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  tooLarge: 413,
  unsupportedType: 415,
  tooMany: 429,
  badGateway: 502,
  unavailable: 503,
} as const;

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
} as const;

/** A JSON response with no-store caching and nosniff. O(n) in the body size. */
export function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** An error the client shows briefly before using its built-in rules (`fallback`). O(1). */
export function fail(
  status: number,
  error: string,
  options: { readonly fallback?: boolean; readonly headers?: Record<string, string> } = {},
): Response {
  const body: AiError = { ok: false, error, fallback: options.fallback ?? true };
  return json(body, status, options.headers);
}
