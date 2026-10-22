import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import {
  cancelRetake,
  commitRetake,
  completeCapture,
  createSession,
  getDroppedPhotoIds,
  getReferencedPhotoIds,
  markReady,
  recordShot,
  setRetakeDraft,
  startRetake,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'
import { createMemoryBackend, type PhotoBackend } from '@/src/features/photobooth/services/storage/photoBackends'
import { createPhotoStore } from '@/src/features/photobooth/services/storage/photoStore'

const HOUR = 60 * 60 * 1000
const CUTOFF = 24 * HOUR

function photo() {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
}

function quotaError() {
  return new DOMException('full', 'QuotaExceededError')
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A shared "IndexedDB" for several tabs, with hooks to force interleavings. */
function createSharedBackend(hooks: { afterListSessions?: () => Promise<void>; putPhoto?: PhotoBackend['putPhoto'] } = {}) {
  const inner = createMemoryBackend()
  const calls = { listSessions: 0, putPhoto: 0 }
  const backend: PhotoBackend = {
    ...inner,
    async putPhoto(stored) {
      calls.putPhoto += 1
      return hooks.putPhoto ? hooks.putPhoto(stored) : inner.putPhoto(stored)
    },
    async listSessions() {
      calls.listSessions += 1
      const records = await inner.listSessions()
      await hooks.afterListSessions?.()
      return records
    },
  }
  return { backend, inner, calls }
}

function createTab(backend: PhotoBackend, clock: { now: number }) {
  return createPhotoStore({
    openPersistent: async () => ({ backend }),
    now: () => clock.now,
    orphanCutoffMs: () => CUTOFF,
  })
}

async function exists(store: ReturnType<typeof createTab>, id: string) {
  return (await store.loadPhoto(id)).status === 'found'
}

describe('photo store: concurrency', () => {
  test('saves racing with garbage collection never lose a photo of a live session', async () => {
    const clock = { now: 10 * CUTOFF }
    const { backend } = createSharedBackend()
    const tab = createTab(backend, clock)

    // Worst case: a collection that does not even protect the session it races with.
    const saving = [tab.savePhoto('s1', photo()), tab.collectGarbage([]), tab.savePhoto('s1', photo()), tab.collectGarbage([])]
    const [first, , second] = await Promise.all(saving)

    assert.equal(await exists(tab, first as string), true)
    assert.equal(await exists(tab, second as string), true)
  })

  test('a session another tab touches mid-collection is kept', async () => {
    const clock = { now: 10 * CUTOFF }
    let tabB: ReturnType<typeof createTab> | null = null
    let savedByB: string | null = null
    const shared = createSharedBackend({
      // Tab B writes right after tab A listed the (then stale) session records.
      afterListSessions: async () => {
        if (tabB && !savedByB) savedByB = await tabB.savePhoto('b', photo())
      },
    })
    await shared.inner.putPhoto({ id: 'b:old', sessionId: 'b', blob: photo(), createdAt: clock.now - 2 * CUTOFF })

    const tabA = createTab(shared.backend, clock)
    tabB = createTab(shared.backend, clock)
    await tabA.collectGarbage(['a'])

    assert.ok(savedByB)
    assert.equal(await exists(tabA, 'b:old'), true)
    assert.equal(await exists(tabA, savedByB), true)
  })

  test('concurrent collection requests are merged into one run', async () => {
    const clock = { now: CUTOFF }
    const shared = createSharedBackend()
    const tab = createTab(shared.backend, clock)

    await Promise.all([tab.collectGarbage(['x']), tab.collectGarbage(['y']), tab.collectGarbage(), tab.collectGarbage(['z'])])
    assert.equal(shared.calls.listSessions, 1)
  })

  test('mutations apply in call order', async () => {
    const clock = { now: CUTOFF }
    const { backend } = createSharedBackend()
    const tab = createTab(backend, clock)

    const saved = tab.savePhoto('s', photo())
    const id = await saved
    const deleted = tab.deletePhotos([id])
    const kept = tab.savePhoto('s', photo())
    await deleted

    assert.equal(await exists(tab, id), false)
    assert.equal(await exists(tab, await kept), true)
  })
})

describe('photo store: session lifecycle', () => {
  test('ended and abandoned sessions are collected; live and protected ones are kept', async () => {
    const clock = { now: 10 * CUTOFF }
    const { backend, inner } = createSharedBackend()
    const put = (id: string, sessionId: string, createdAt: number) => inner.putPhoto({ id, sessionId, blob: photo(), createdAt })

    await put('live:1', 'live', clock.now - HOUR)
    await put('stale:1', 'stale', clock.now - 2 * CUTOFF)
    await put('mine:1', 'mine', clock.now - 2 * CUTOFF)
    await put('ended:1', 'ended', clock.now - HOUR)
    await inner.markSessionEnded('ended', clock.now - HOUR)

    const tab = createTab(backend, clock)
    await tab.collectGarbage(['mine'])

    assert.equal(await exists(tab, 'live:1'), true, 'recently active session in another tab')
    assert.equal(await exists(tab, 'mine:1'), true, 'this tab protects its own session even when old')
    assert.equal(await exists(tab, 'stale:1'), false, 'abandoned past the cutoff')
    assert.equal(await exists(tab, 'ended:1'), false, 'ended session')
    // The ended session keeps a tombstone (no photos) until the cutoff passes.
    assert.deepEqual((await inner.listSessions()).map((record) => record.id).sort(), ['ended', 'live', 'mine'])
  })

  test('photos without a session record get a grace period instead of being deleted', async () => {
    const clock = { now: 10 * CUTOFF }
    const { backend: base, inner } = createSharedBackend()
    // Written by a build that kept no session records; the photo itself is old.
    await inner.putPhoto({ id: 'legacy:1', sessionId: 'legacy', blob: photo(), createdAt: 0 })
    const unrecorded = new Set(['legacy'])
    const backend: PhotoBackend = {
      ...base,
      async listSessions() {
        return (await base.listSessions()).filter((record) => !unrecorded.has(record.id))
      },
      async touchSession(sessionId, now) {
        unrecorded.delete(sessionId)
        return base.touchSession(sessionId, now)
      },
    }

    const tab = createTab(backend, clock)
    await tab.collectGarbage([])
    assert.equal(await exists(tab, 'legacy:1'), true)

    clock.now += CUTOFF + 1
    await tab.collectGarbage([])
    assert.equal(await exists(tab, 'legacy:1'), false)
  })

  test('tombstones of ended sessions expire after the cutoff', async () => {
    const clock = { now: 10 * CUTOFF }
    const { backend, inner } = createSharedBackend()
    const tab = createTab(backend, clock)

    await tab.endSession('gone')
    await tab.collectGarbage([])
    assert.equal((await inner.listSessions()).length, 1)

    clock.now += CUTOFF + 1
    await tab.collectGarbage([])
    assert.equal((await inner.listSessions()).length, 0)
  })

  test('rapid restart: a save still in flight for the ended session is deleted too', async () => {
    const clock = { now: CUTOFF }
    let releasePut: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      releasePut = resolve
    })
    const shared = createSharedBackend()
    const inner = shared.inner
    const slowBackend: PhotoBackend = {
      ...shared.backend,
      async putPhoto(stored) {
        if (stored.sessionId === 's1') await gate
        return inner.putPhoto(stored)
      },
    }
    const tab = createTab(slowBackend, clock)

    const inFlight = tab.savePhoto('s1', photo())
    const ended = tab.endSession('s1')
    const next = tab.savePhoto('s2', photo())
    await tick()
    releasePut()

    const lateId = await inFlight
    assert.deepEqual(await ended, { complete: true })
    const nextId = await next
    assert.equal(await exists(tab, lateId), false)
    assert.equal(await exists(tab, nextId), true)
  })

  test('a photo landing after its session ended never revives the session', async () => {
    const clock = { now: CUTOFF }
    const { backend, inner } = createSharedBackend()
    const tabA = createTab(backend, clock)
    const tabB = createTab(backend, clock)

    await tabA.endSession('s')
    const late = await tabB.savePhoto('s', photo())
    assert.notEqual((await inner.listSessions()).find((record) => record.id === 's')?.endedAt ?? null, null)

    await tabA.collectGarbage([])
    assert.equal(await exists(tabA, late), false)
  })

  test('endSession reports incomplete when IndexedDB cannot be reached', async () => {
    const store = createPhotoStore({ openPersistent: async () => ({ backend: null, reason: 'error' }) })
    assert.deepEqual(await store.endSession('s'), { complete: false })
  })

  test('endSession reports incomplete when deleting fails', async () => {
    const { backend } = createSharedBackend()
    const failing: PhotoBackend = {
      ...backend,
      collectSession: async () => {
        throw new Error('IDB_ABORTED')
      },
    }
    const store = createPhotoStore({ openPersistent: async () => ({ backend: failing }) })
    assert.deepEqual(await store.endSession('s'), { complete: false })
  })
})

describe('photo store: retake references', () => {
  function captured(): PhotoboothSession {
    let session = markReady(createSession(getExperience('quick-4'), 's', 0), 0, 0)
    for (let index = 0; index < 4; index += 1) session = recordShot(session, index, `p${index}`, 0)
    return completeCapture(session, 0)
  }

  async function storeWith(session: PhotoboothSession, extra: string[]) {
    const { backend, inner } = createSharedBackend()
    for (const id of [...getReferencedPhotoIds(session), ...extra]) {
      await inner.putPhoto({ id, sessionId: session.id, blob: photo(), createdAt: 0 })
    }
    return createTab(backend, { now: 0 })
  }

  test('the draft survives until it is committed, then only the replaced original goes', async () => {
    const withDraft = setRetakeDraft(startRetake(captured(), 0, 1), 'draft', 1)
    const store = await storeWith(withDraft, [])
    await store.collectGarbage([])
    assert.equal(await exists(store, 'draft'), true)

    const committed = commitRetake(withDraft, 2)
    await store.deletePhotos(getDroppedPhotoIds(withDraft, committed))
    assert.equal(await exists(store, 'p0'), false)
    for (const id of ['draft', 'p1', 'p2', 'p3']) assert.equal(await exists(store, id), true, id)
  })

  test('cancel keeps the original and deletes only the draft', async () => {
    const withDraft = setRetakeDraft(startRetake(captured(), 3, 1), 'draft', 1)
    const store = await storeWith(withDraft, [])

    const cancelled = cancelRetake(withDraft, 2)
    await store.deletePhotos(getDroppedPhotoIds(withDraft, cancelled))
    assert.equal(await exists(store, 'draft'), false)
    for (const id of ['p0', 'p1', 'p2', 'p3']) assert.equal(await exists(store, id), true, id)
  })

  test('a second draft replaces the first one only', async () => {
    const first = setRetakeDraft(startRetake(captured(), 2, 1), 'draft-1', 1)
    const store = await storeWith(first, ['draft-2'])

    const second = setRetakeDraft(first, 'draft-2', 2)
    assert.deepEqual(getDroppedPhotoIds(first, second), ['draft-1'])
    await store.deletePhotos(getDroppedPhotoIds(first, second))
    assert.equal(await exists(store, 'draft-2'), true)
    assert.equal(await exists(store, 'p2'), true)
  })
})

describe('photo store: degraded storage', () => {
  test('a full IndexedDB first frees abandoned sessions, then retries', async () => {
    const clock = { now: 10 * CUTOFF }
    let full = true
    const shared = createSharedBackend({
      putPhoto: async (stored) => {
        if (full && stored.sessionId === 'mine') {
          full = false
          throw quotaError()
        }
        return shared.inner.putPhoto(stored)
      },
    })
    await shared.inner.putPhoto({ id: 'old:1', sessionId: 'old', blob: photo(), createdAt: 0 })
    const tab = createTab(shared.backend, clock)

    const id = await tab.savePhoto('mine', photo())
    assert.equal(await exists(tab, 'old:1'), false)
    assert.equal(await exists(tab, id), true)
    assert.deepEqual(await tab.getStatus(), { backend: 'available' })
    assert.deepEqual(tab.getMemoryOnlyPhotos([id]), [])
  })

  test('still full: the photo is kept in memory and the store reports it', async () => {
    const shared = createSharedBackend({
      putPhoto: async () => {
        throw quotaError()
      },
    })
    const tab = createTab(shared.backend, { now: 0 })

    const id = await tab.savePhoto('mine', photo())
    assert.equal(await exists(tab, id), true)
    assert.deepEqual(tab.getMemoryOnlyPhotos([id]), [{ id, reason: 'quota' }])
    // The backend itself still works; only this photo could not be persisted.
    assert.deepEqual(await tab.getStatus(), { backend: 'available' })
  })

  test('without IndexedDB everything stays in memory and is reported', async () => {
    const store = createPhotoStore({ openPersistent: async () => ({ backend: null, reason: 'unsupported' }) })
    assert.deepEqual(await store.getStatus(), { backend: 'unavailable' })

    const id = await store.savePhoto('s', photo())
    assert.equal(await exists(store as ReturnType<typeof createTab>, id), true)
    assert.deepEqual(store.getMemoryOnlyPhotos([id]), [{ id, reason: 'unavailable' }])
    assert.deepEqual(await store.endSession('s'), { complete: true })
    assert.deepEqual(await store.loadPhoto(id), { status: 'missing' })
  })

  test('a transient read failure is retried before a photo is reported missing', async () => {
    const { backend, inner } = createSharedBackend()
    await inner.putPhoto({ id: 'p', sessionId: 's', blob: photo(), createdAt: 0 })
    let failures = 1
    const flaky: PhotoBackend = {
      ...backend,
      async getPhoto(id) {
        if (failures-- > 0) throw new Error('connection closed')
        return inner.getPhoto(id)
      },
    }
    const store = createPhotoStore({ openPersistent: async () => ({ backend: flaky }) })
    assert.equal((await store.loadPhoto('p')).status, 'found')
  })

  test('a failed open is not remembered: storage that comes back is used again', async () => {
    const { backend } = createSharedBackend()
    let available = false
    const store = createPhotoStore({
      openPersistent: async () => (available ? { backend } : { backend: null, reason: 'error' }),
    })
    assert.deepEqual(await store.getStatus(), { backend: 'error' })

    available = true
    assert.deepEqual(await store.getStatus(), { backend: 'available' })
    const id = await store.savePhoto('s', photo())
    assert.deepEqual(store.getMemoryOnlyPhotos([id]), [])
  })

  test('unreadable storage is reported as an error, never as a missing photo', async () => {
    const { backend } = createSharedBackend()
    const broken: PhotoBackend = {
      ...backend,
      async getPhoto() {
        throw new Error('connection closed')
      },
    }
    assert.deepEqual(await createTab(broken, { now: 0 }).loadPhoto('p'), { status: 'error' })

    const cannotOpen = createPhotoStore({ openPersistent: async () => ({ backend: null, reason: 'error' }) })
    assert.deepEqual(await cannotOpen.loadPhoto('p'), { status: 'error' })
  })
})

describe('photo store: memory-only tracking', () => {
  /** IndexedDB that can be switched off and on, like a broken connection that recovers. */
  function switchableStore() {
    const { backend } = createSharedBackend()
    const state = { available: false }
    // Down means: it cannot be opened, and an open connection fails its writes.
    const switchable: PhotoBackend = {
      ...backend,
      async putPhoto(stored) {
        if (!state.available) throw new Error('IDB_ABORTED')
        return backend.putPhoto(stored)
      },
    }
    const store = createPhotoStore({
      openPersistent: async () => (state.available ? { backend: switchable } : { backend: null, reason: 'error' }),
    })
    return { store, state }
  }

  test('mixed storage: one memory photo keeps the whole session reload-unsafe', async () => {
    const { store, state } = switchableStore()
    state.available = true
    const first = await store.savePhoto('s', photo())
    state.available = false
    const second = await store.savePhoto('s', photo())
    state.available = true
    const third = await store.savePhoto('s', photo())

    assert.deepEqual(store.getMemoryOnlyPhotos([first, second, third]), [{ id: second, reason: 'error' }])
    // The last save succeeded, but that does not make the session safe.
    assert.deepEqual(await store.getStatus(), { backend: 'available' })
  })

  test('deleting the only memory photo clears the warning', async () => {
    const { store } = switchableStore()
    const id = await store.savePhoto('s', photo())
    assert.equal(store.getMemoryOnlyPhotos([id]).length, 1)

    await store.deletePhotos([id])
    assert.deepEqual(store.getMemoryOnlyPhotos([id]), [])
  })

  test('a new session never inherits the previous session\'s memory-only warning', async () => {
    const { store, state } = switchableStore()
    const old = await store.savePhoto('old', photo())
    await store.endSession('old')

    state.available = true
    const fresh = await store.savePhoto('new', photo())
    assert.deepEqual(store.getMemoryOnlyPhotos([fresh]), [])
    assert.deepEqual(store.getMemoryOnlyPhotos([old]), [], 'ended photos are gone, not just hidden')
  })

  test('retake with memory photos: cancel drops the draft, commit drops the replaced original', async () => {
    const { store } = switchableStore()
    const original = await store.savePhoto('s', photo())
    const draft = await store.savePhoto('s', photo())

    await store.deletePhotos([draft])
    assert.deepEqual(store.getMemoryOnlyPhotos([original, draft]).map((item) => item.id), [original])

    const replacement = await store.savePhoto('s', photo())
    await store.deletePhotos([original])
    assert.deepEqual(store.getMemoryOnlyPhotos([original, replacement]).map((item) => item.id), [replacement])
  })

  test('garbage collection of an abandoned memory session clears its photos', async () => {
    const clock = { now: 0 }
    const store = createPhotoStore({
      openPersistent: async () => ({ backend: null, reason: 'unsupported' }),
      now: () => clock.now,
      orphanCutoffMs: () => CUTOFF,
    })
    const id = await store.savePhoto('gone', photo())
    clock.now = CUTOFF + 1
    await store.collectGarbage(['current'])
    assert.deepEqual(store.getMemoryOnlyPhotos([id]), [])
    assert.deepEqual(await store.loadPhoto(id), { status: 'missing' })
  })

  test('recovering storage persists new photos while old memory photos stay flagged', async () => {
    const { store, state } = switchableStore()
    const memoryPhoto = await store.savePhoto('s', photo())
    state.available = true
    const persisted = await store.savePhoto('s', photo())

    assert.deepEqual(store.getMemoryOnlyPhotos([memoryPhoto, persisted]).map((item) => item.id), [memoryPhoto])
    assert.equal((await store.loadPhoto(memoryPhoto)).status, 'found', 'nothing is silently dropped')
  })
})
