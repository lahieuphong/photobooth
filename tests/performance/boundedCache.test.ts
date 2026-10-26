import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBoundedCache } from '@/src/features/photobooth/utils/boundedCache'

test('derived caches stay bounded across thousands of distinct photos or dates', () => {
  const cache = createBoundedCache<string, string>(128)
  for (let index = 0; index < 10_000; index += 1) cache.set(`photo-${index}`, `value-${index}`)
  assert.equal(cache.size, 128)
  assert.equal(cache.get('photo-0'), undefined)
  assert.equal(cache.get('photo-9999'), 'value-9999')
})

test('recently used entries survive eviction and replacements do not grow the cache', () => {
  const cache = createBoundedCache<string, number>(2)
  cache.set('a', 1)
  cache.set('b', 2)
  assert.equal(cache.get('a'), 1)
  cache.set('c', 3)
  assert.equal(cache.get('b'), undefined)
  cache.set('a', 4)
  assert.equal(cache.size, 2)
  assert.equal(cache.get('a'), 4)
})

test('null is a cached value and invalid capacities are rejected', () => {
  const cache = createBoundedCache<string, null>(1)
  cache.set('no-frame', null)
  assert.equal(cache.get('no-frame'), null)
  for (const capacity of [0, -1, Infinity, 1.5]) assert.throws(() => createBoundedCache(capacity))
})
