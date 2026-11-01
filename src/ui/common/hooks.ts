/** Small hooks shared by the screens. */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Returns a function that cancels the previous request and gives a fresh signal.
 * Everything still running is cancelled when the component goes away, so a late
 * answer can never change a screen the user has left.
 */
export function useAbortable(): () => AbortSignal {
  const current = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      current.current?.abort();
    },
    [],
  );
  return useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return controller.signal;
  }, []);
}

/** Moves keyboard and screen-reader focus to the element when it appears. */
export function useFocusOnMount<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/** A request in flight and its latest answer. */
export interface Ask<T> {
  readonly busy: boolean;
  readonly result: T | null;
  /** Starts `task`, cancelling the previous one; resolves to null if it was cancelled. */
  readonly run: (task: (signal: AbortSignal) => Promise<T>) => Promise<T | null>;
  /** Cancels any request and clears the answer. */
  readonly clear: () => void;
}

/** Busy flag, latest answer and cancellation for one kind of AI request. */
export function useAsk<T>(): Ask<T> {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const fresh = useAbortable();
  const run = useCallback(
    async (task: (signal: AbortSignal) => Promise<T>) => {
      const signal = fresh();
      setBusy(true);
      setResult(null);
      try {
        const value = await task(signal);
        if (signal.aborted) return null;
        setResult(value);
        return value;
      } finally {
        // A newer request (or clear) owns the busy flag once this one is cancelled.
        if (!signal.aborted) setBusy(false);
      }
    },
    [fresh],
  );
  const clear = useCallback(() => {
    fresh();
    setBusy(false);
    setResult(null);
  }, [fresh]);
  return { busy, result, run, clear };
}

/**
 * Moves focus to the new screen's main heading when the screen changes. Not on
 * page load: the browser's own start point (and the skip link) comes first.
 */
export function useScreenFocus(screen: string): void {
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [screen]);
}
