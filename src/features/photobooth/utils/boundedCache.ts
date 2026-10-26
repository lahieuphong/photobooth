/** Small metadata cache. Eviction drops derived values, never stored photos or live object URLs. */
export function createBoundedCache<K, V>(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Cache capacity must be a positive integer')
  const entries = new Map<K, V>()
  return {
    get size() { return entries.size },
    get(key: K): V | undefined {
      const value = entries.get(key)
      if (entries.has(key)) {
        entries.delete(key)
        entries.set(key, value as V)
      }
      return value
    },
    set(key: K, value: V) {
      entries.delete(key)
      entries.set(key, value)
      if (entries.size > capacity) entries.delete(entries.keys().next().value as K)
    },
  }
}
