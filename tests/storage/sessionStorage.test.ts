import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { createSession } from '@/src/features/photobooth/domain/session'
import { consumeSessionNotice, readSessionForUpdate, readStoredSession, writeStoredSession } from '@/src/features/photobooth/services/storage/sessionStorage'

const KEY = 'photobooth.session.v2'

function withStorage(values: Map<string, string>, run: (storage: Storage) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage: Storage = {
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    clear: () => values.clear(),
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: storage } })
  try { run(storage) } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}

test('a storage read failure is unavailable, never an empty or discarded session', () => {
  const values = new Map([[KEY, 'preserve this data']])
  withStorage(values, (storage) => {
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    assert.deepEqual(readStoredSession(), { session: null, discarded: false, unavailable: true })
    assert.equal(values.get(KEY), 'preserve this data')
    assert.equal(consumeSessionNotice(), null)
  })
})

test('code about to change the session gets a storage error, not "no session", when reading fails', () => {
  const session = createSession(getExperience('quick-4'), 's', 123)
  withStorage(new Map([[KEY, JSON.stringify(session)]]), (storage) => {
    assert.deepEqual(readSessionForUpdate(), session)
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    assert.throws(() => readSessionForUpdate(), { message: 'SESSION_STORAGE_UNAVAILABLE' })
  })
  withStorage(new Map(), () => assert.equal(readSessionForUpdate(), null))
})

test('a valid session round-trips, while genuinely malformed JSON is discarded', () => {
  const values = new Map<string, string>()
  withStorage(values, () => {
    assert.deepEqual(readStoredSession(), { session: null, discarded: false, unavailable: false })
    const session = createSession(getExperience('quick-4'), 's', 123)
    writeStoredSession(session)
    assert.deepEqual(readStoredSession(), { session, discarded: false, unavailable: false })
    values.set(KEY, '{broken')
    assert.deepEqual(readStoredSession(), { session: null, discarded: true, unavailable: false })
    assert.equal(values.has(KEY), false)
  })
})

test('failed cleanup and notice reads cannot throw out of the loading effect', () => {
  const values = new Map([[KEY, '{broken'], ['photobooth.notice', 'session-reset']])
  withStorage(values, (storage) => {
    storage.removeItem = () => { throw new DOMException('blocked', 'SecurityError') }
    assert.equal(readStoredSession().unavailable, true)
    assert.equal(consumeSessionNotice(), null)
    assert.equal(values.get(KEY), '{broken')
  })
})

test('failed writes still throw so capture and start handlers can report failure', () => {
  withStorage(new Map(), (storage) => {
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
    assert.throws(() => writeStoredSession(createSession(getExperience('quick-4'), 's', 123)))
  })
})
