/**
 * Checked access for indexes and keys the code has already established exist
 * (split results, regex groups, graph maps). A miss is a programming error, so
 * these throw instead of inventing a default that would hide the bug.
 */

/** `items[index]`, or a RangeError when the index is out of range. O(1). */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`No item at index ${String(index)}`);
  return item;
}

/** `map.get(key)`, or a RangeError when the key is missing. O(1). */
export function lookup<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new RangeError(`No entry for "${String(key)}"`);
  return value;
}

/** `record[key]`, or a RangeError when the key is missing. O(1). */
export function field<V>(record: Readonly<Record<string, V>>, key: string): V {
  const value = record[key];
  if (value === undefined) throw new RangeError(`No field "${key}"`);
  return value;
}
