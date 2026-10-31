/** Storage test doubles: wrap a real store and replace the methods a test needs to break. */
type Overrides = Partial<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>;

/** A Storage that forwards to `base` except for the given methods. */
export function storageWith(base: Storage, overrides: Overrides): Storage {
  return {
    get length() {
      return base.length;
    },
    clear: () => {
      base.clear();
    },
    key: (index) => base.key(index),
    getItem: overrides.getItem ?? ((key) => base.getItem(key)),
    setItem:
      overrides.setItem ??
      ((key, value) => {
        base.setItem(key, value);
      }),
    removeItem:
      overrides.removeItem ??
      ((key) => {
        base.removeItem(key);
      }),
  };
}

/** Throws the way a full or blocked browser store does. */
export const quotaExceeded = (): never => {
  throw new DOMException('full', 'QuotaExceededError');
};
