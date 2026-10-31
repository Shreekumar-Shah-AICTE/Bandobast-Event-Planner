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

/**
 * Reads the body as a stream and stops as soon as it passes the size cap, so a
 * missing or wrong Content-Length cannot make the function buffer a huge body. O(n).
 */
export async function readBody(request: Request): Promise<string | null> {
  if (request.body === null) return '';
  const reader: ReadableStreamDefaultReader<Uint8Array> = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > SERVER_CONFIG.maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * A keyed hash of the client IP, so the limiter never stores raw addresses.
 * On Vercel both headers are set by the platform's edge, not by the caller. O(1).
 */
export async function clientKey(request: Request, salt: string): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = request.headers.get('x-real-ip') ?? forwarded ?? 'unknown';
  return (await sha256(salt, ip)).slice(0, SERVER_CONFIG.clientKeyLength);
}
