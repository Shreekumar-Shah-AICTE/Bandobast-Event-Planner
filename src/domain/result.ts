/** Expected failures are values, not exceptions. */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a success value. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Wraps an expected failure. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
