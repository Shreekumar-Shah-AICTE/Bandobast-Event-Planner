/** Request checks that run before any input is parsed or any store is touched. */
import { SERVER_CONFIG } from './config.js';
import { STATUS, fail } from './http.js';
import { sha256 } from './store.js';

/** First failing check as a response, or null when the request may proceed. O(1). */
export function checkRequest(request: Request): Response | null {
  if (request.method !== 'POST') {
    return fail(STATUS.methodNotAllowed, 'Use POST.', {
      fallback: false,
      headers: { Allow: 'POST' },
    });
  }
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return fail(STATUS.unsupportedType, 'Send JSON.', { fallback: false });
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > SERVER_CONFIG.maxBodyBytes)
    return fail(STATUS.tooLarge, 'Request too large.', { fallback: false });
  const origin = request.headers.get('origin');
  if (origin === null || !sameHost(origin, request.url)) {
    return fail(STATUS.forbidden, 'Cross-site requests are not allowed.', { fallback: false });
  }
  return null;
}

function sameHost(origin: string, url: string): boolean {
  try {
    return new URL(origin).host === new URL(url).host;
  } catch {
    return false;
  }
}

/** Reads the body with a hard size cap (the header can be missing or wrong). */
export async function readBody(request: Request): Promise<string | null> {
  const text = await request.text();
  return new TextEncoder().encode(text).length > SERVER_CONFIG.maxBodyBytes ? null : text;
}

/** A salted hash of the client IP: the limiter never stores raw addresses. O(1). */
export async function clientKey(request: Request, salt: string): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = request.headers.get('x-real-ip') ?? forwarded ?? 'unknown';
  return (await sha256(salt, ip)).slice(0, SERVER_CONFIG.clientKeyLength);
}
