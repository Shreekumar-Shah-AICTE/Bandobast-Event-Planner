/**
 * The browser's localStorage, or an in-memory stand-in when the browser blocks
 * it (some private modes throw on access). The app works either way and says so.
 */
export interface StorageChoice {
  readonly storage: Storage;
  /** False when the plan only lasts while the tab is open. */
  readonly persistent: boolean;
}

/** A Map-backed Storage for when localStorage is blocked. */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

/** localStorage if it can be used, otherwise memory. O(1). */
export function chooseStorage(read: () => Storage): StorageChoice {
  try {
    const storage = read();
    storage.getItem('');
    return { storage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
