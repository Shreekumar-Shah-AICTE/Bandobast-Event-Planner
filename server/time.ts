/** Small time helpers for the AI function. */

/**
 * Resolves with the work's result, or with `fallback` if it fails or takes
 * longer than `ms`. Used for best-effort store calls. O(1).
 */
export function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });
  return Promise.race([work.catch(() => fallback), late]).finally(() => {
    clearTimeout(timer);
  });
}
