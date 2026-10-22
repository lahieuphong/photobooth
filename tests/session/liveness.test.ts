import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { describeReloadLoss, describeStorageRisk } from '@/src/features/photobooth/config/storageNotices'
import { getIdlePhase } from '@/src/features/photobooth/domain/inactivity'
import { getLastActivityAt } from '@/src/features/photobooth/services/session/activity'
import { HEARTBEAT_INTERVAL_MS, startSessionHeartbeat } from '@/src/features/photobooth/services/session/heartbeat'
import { createMemoryBackend } from '@/src/features/photobooth/services/storage/photoBackends'
import { createPhotoStore } from '@/src/features/photobooth/services/storage/photoStore'
import { createSessionOwnership, type LockManagerLike } from '@/src/features/photobooth/services/storage/sessionOwnership'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Interval scheduler driven by the test. */
function createIntervals() {
  const intervals = new Map<number, () => void>()
  let nextId = 1
  return {
    setInterval: ((callback: () => void) => {
      const id = nextId++
      intervals.set(id, callback)
      return id as unknown as ReturnType<typeof setInterval>
    }) as (callback: () => void, ms: number) => ReturnType<typeof setInterval>,
    clearInterval: ((id: ReturnType<typeof setInterval>) => {
      intervals.delete(id as unknown as number)
    }) as (id: ReturnType<typeof setInterval>) => void,
    tick: () => intervals.forEach((callback) => callback()),
    count: () => intervals.size,
  }
}

/** One LockManager shared by several "tabs", like the browser's per-origin one. */
function createLockManager(): LockManagerLike & { names: () => string[] } {
  const held = new Set<string>()
  return {
    async request(name, _options, callback) {
      if (held.has(name)) return callback(null)
      held.add(name)
      try {
        await callback({ name })
      } finally {
        held.delete(name)
      }
    },
    async query() {
      return { held: [...held].map((name) => ({ name })) }
    },
    names: () => [...held],
  }
}

describe('session heartbeat', () => {
  function heartbeat({ sessionId = 's' as string | null, owned = true } = {}) {
    const intervals = createIntervals()
    const touched: string[] = []
    const state = { sessionId, owned }
    let resume: () => void = () => undefined
    const stop = startSessionHeartbeat({
      getSessionId: () => state.sessionId,
      owns: () => state.owned,
      touch: (id) => touched.push(id),
      setInterval: intervals.setInterval,
      clearInterval: intervals.clearInterval,
      onResume: (callback) => {
        resume = callback
        return () => {
          resume = () => undefined
        }
      },
    })
    return { intervals, touched, state, stop, resume: () => resume() }
  }

  test('beats at once and on every interval with no user activity at all', () => {
    const { intervals, touched } = heartbeat()
    intervals.tick()
    intervals.tick()
    assert.deepEqual(touched, ['s', 's', 's'])
    assert.equal(HEARTBEAT_INTERVAL_MS, MINUTE)
  })

  test('never keeps alive a session this tab does not own (duplicated tab)', () => {
    const { intervals, touched } = heartbeat({ owned: false })
    intervals.tick()
    assert.deepEqual(touched, [])
  })

  test('stops beating once the session is ended, and after stop()', () => {
    const { intervals, touched, state, stop } = heartbeat()
    state.sessionId = null
    intervals.tick()
    assert.deepEqual(touched, ['s'])

    state.sessionId = 's2'
    stop()
    intervals.tick()
    assert.equal(intervals.count(), 0)
    assert.deepEqual(touched, ['s'])
  })

  test('a page resuming from the background beats immediately', () => {
    const { touched, resume } = heartbeat()
    resume()
    assert.deepEqual(touched, ['s', 's'])
  })

  test('heartbeats never count as user activity: the kiosk still expires', () => {
    const before = getLastActivityAt(0)
    const { intervals } = heartbeat()
    for (let minute = 0; minute < 20; minute += 1) intervals.tick()
    assert.equal(getLastActivityAt(), before)
    assert.deepEqual(
      getIdlePhase({ now: before + 15 * MINUTE, lastActivityAt: getLastActivityAt(), busy: false, idleTimeoutMs: 15 * MINUTE, warningMs: MINUTE }),
      { phase: 'expired' }
    )
  })
})

describe('session ownership (Web Locks)', () => {
  test('a duplicated tab cannot claim a session another tab holds, until it is released', async () => {
    const locks = createLockManager()
    const tabA = createSessionOwnership(() => locks, 0)
    const tabB = createSessionOwnership(() => locks, 0)

    assert.equal(await tabA.claim('s'), true)
    assert.equal(await tabB.claim('s'), false)
    assert.equal(tabA.owns('s'), true)
    assert.equal(tabB.owns('s'), false)
    assert.deepEqual([...(await tabB.listLiveSessionIds())], ['s'])

    tabA.release('s')
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(await tabB.claim('s'), true)
  })

  test('screens claiming together in one tab share the claim', async () => {
    const locks = createLockManager()
    const tab = createSessionOwnership(() => locks, 0)
    assert.deepEqual(await Promise.all([tab.claim('s'), tab.claim('s')]), [true, true])
  })

  test('claiming a new session lets go of the previous one', async () => {
    const locks = createLockManager()
    const tab = createSessionOwnership(() => locks, 0)
    await tab.claim('old')
    await tab.claim('new')
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(locks.names(), ['photobooth-session:new'])
    assert.equal(tab.owns('old'), false)
  })

  test('a failing Locks API never blocks the tab, and its session keeps its heartbeat', async () => {
    const broken: LockManagerLike = {
      request: async () => {
        throw new Error('locks unavailable')
      },
      query: async () => ({ held: [] }),
    }
    const tab = createSessionOwnership(() => broken, 0)
    assert.equal(await tab.claim('s'), true)
    assert.equal(tab.owns('s'), true)
    tab.release('s')
    assert.equal(tab.owns('s'), false)
  })

  test('without Web Locks the tab treats its session as its own and reports no live list', async () => {
    const tab = createSessionOwnership(() => null)
    assert.equal(await tab.claim('s'), true)
    assert.equal(tab.owns('s'), true)
    assert.equal((await tab.listLiveSessionIds()).size, 0)
  })
})

describe('garbage collection and liveness', () => {
  function storeWith(live: Set<string>, clock: { now: number }) {
    const backend = createMemoryBackend()
    const store = createPhotoStore({
      openPersistent: async () => ({ backend }),
      now: () => clock.now,
      orphanCutoffMs: () => DAY,
      getLiveSessionIds: async () => live,
    })
    return { backend, store }
  }

  test('a held session survives any heartbeat age (frozen background tab)', async () => {
    const clock = { now: 10 * DAY }
    const live = new Set(['frozen'])
    const { backend, store } = storeWith(live, clock)
    await backend.putPhoto({ id: 'frozen:1', sessionId: 'frozen', blob: new Blob(['x']), createdAt: 0 })

    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('frozen:1')).status, 'found')

    // The tab closed or crashed: the browser released its lock, so retention applies.
    live.clear()
    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('frozen:1')).status, 'missing')
  })

  test('crash recovery: an unheld session is kept until the cutoff, then collected', async () => {
    const clock = { now: DAY }
    const { backend, store } = storeWith(new Set(), clock)
    await backend.putPhoto({ id: 'crashed:1', sessionId: 'crashed', blob: new Blob(['x']), createdAt: clock.now })

    clock.now += DAY - 1
    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('crashed:1')).status, 'found')

    clock.now += 2
    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('crashed:1')).status, 'missing')
  })

  test('an ended session is collected even while its tab still holds the lock', async () => {
    const clock = { now: DAY }
    const { backend, store } = storeWith(new Set(['ended']), clock)
    await backend.putPhoto({ id: 'ended:1', sessionId: 'ended', blob: new Blob(['x']), createdAt: clock.now })
    await backend.markSessionEnded('ended', clock.now)

    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('ended:1')).status, 'missing')
  })

  test('tombstones with no photos left cost no write transaction', async () => {
    const clock = { now: DAY }
    const inner = createMemoryBackend()
    let collects = 0
    const backend = {
      ...inner,
      async collectSession(...args: Parameters<typeof inner.collectSession>) {
        collects += 1
        return inner.collectSession(...args)
      },
    }
    const store = createPhotoStore({ openPersistent: async () => ({ backend }), now: () => clock.now, orphanCutoffMs: () => DAY })
    await store.endSession('done')
    collects = 0
    await store.collectGarbage([])
    await store.collectGarbage([])
    assert.equal(collects, 0)

    // A late photo for the ended session is still collected.
    await inner.putPhoto({ id: 'done:late', sessionId: 'done', blob: new Blob(['x']), createdAt: clock.now })
    await store.collectGarbage([])
    assert.equal(collects, 1)
    assert.equal((await store.loadPhoto('done:late')).status, 'missing')
  })

  test('a heartbeat landing between listing and collecting saves the session', async () => {
    const clock = { now: 10 * DAY }
    const inner = createMemoryBackend()
    await inner.putPhoto({ id: 'late:1', sessionId: 'late', blob: new Blob(['x']), createdAt: 0 })
    const backend = {
      ...inner,
      async listSessions() {
        const records = await inner.listSessions()
        await inner.touchSession('late', clock.now)
        return records
      },
    }
    const store = createPhotoStore({ openPersistent: async () => ({ backend }), now: () => clock.now, orphanCutoffMs: () => DAY })
    await store.collectGarbage([])
    assert.equal((await store.loadPhoto('late:1')).status, 'found')
  })
})

describe('storage warnings', () => {
  test('no warning for a reload-safe session on working storage', () => {
    assert.equal(describeStorageRisk({ backend: 'available' }, []), null)
    assert.equal(describeReloadLoss([]), null)
  })

  test('memory-only photos of this session are named with their cause', () => {
    const text = describeStorageRisk({ backend: 'available' }, [{ id: 'a', reason: 'quota' }]) ?? ''
    assert.match(text, /^1 ảnh chỉ được giữ tạm/)
    assert.match(text, /đã đầy/)
    assert.match(describeReloadLoss([{ id: 'a', reason: 'error' }, { id: 'b', reason: 'error' }]) ?? '', /mất 2 ảnh/)
  })

  test('unusable storage warns before any photo is taken', () => {
    assert.match(describeStorageRisk({ backend: 'unavailable' }, []) ?? '', /không cho lưu ảnh lâu dài/)
    assert.match(describeStorageRisk({ backend: 'error' }, []) ?? '', /không phản hồi/)
    assert.equal(describeStorageRisk(null, []), null)
  })
})
