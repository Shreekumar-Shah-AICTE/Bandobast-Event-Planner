import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsk } from './hooks.js';

describe('useAsk', () => {
  it('shows busy while a request runs, then keeps its answer', async () => {
    const { result } = renderHook(() => useAsk<number>());
    let finish: (value: number) => void = () => undefined;
    let pending: Promise<number | null> = Promise.resolve(null);
    act(() => {
      pending = result.current.run(() => new Promise<number>((resolve) => (finish = resolve)));
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      finish(42);
      await pending;
    });
    expect(result.current).toMatchObject({ busy: false, result: 42 });
  });

  it('never leaves the button disabled when a request fails', async () => {
    const { result } = renderHook(() => useAsk<number>());
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error('offline')))).rejects.toThrow(
        'offline',
      );
    });
    expect(result.current).toMatchObject({ busy: false, result: null });
  });

  it('drops the answer of a request that a newer one replaced', async () => {
    const { result } = renderHook(() => useAsk<string>());
    let first: Promise<string | null> = Promise.resolve(null);
    let finishFirst: (value: string) => void = () => undefined;
    act(() => {
      first = result.current.run(() => new Promise<string>((resolve) => (finishFirst = resolve)));
    });
    await act(async () => {
      await result.current.run(() => Promise.resolve('newer'));
      finishFirst('older');
      expect(await first).toBeNull();
    });
    expect(result.current).toMatchObject({ busy: false, result: 'newer' });
  });
});
