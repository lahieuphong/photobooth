// Storage backends behind photoStore. Every method is one atomic step, so the
// cleanup policy in photoStore never has to reason about half-applied writes:
// IndexedDB runs each method in a single transaction, memory runs it synchronously.

export type StoredPhoto = {
  id: string
  sessionId: string
  blob: Blob
  createdAt: number
}

/** Liveness of a session, shared by every tab on this origin (IndexedDB) or this tab (memory). */
export type SessionRecord = {
  id: string
  lastActiveAt: number
  /** Set when the session was reset or expired; its photos may be deleted at any time. */
  endedAt: number | null
}

export interface PhotoBackend {
  /** Stores the photo and marks its session active, atomically. Never revives an ended session. */
  putPhoto(photo: StoredPhoto): Promise<void>
  getPhoto(id: string): Promise<Blob | null>
  touchSession(sessionId: string, now: number): Promise<void>
  markSessionEnded(sessionId: string, now: number): Promise<void>
  listSessions(): Promise<SessionRecord[]>
  /** Session ids that still own at least one photo (keys only, blobs are not read). */
  listPhotoSessionIds(): Promise<string[]>
  deletePhotos(ids: string[]): Promise<void>
  /**
   * Deletes every photo of the session if `decide` allows it for the record read
   * inside the same atomic step, so a session another tab touched in the
   * meantime is never collected. `keepRecord` leaves the (ended) record behind
   * as a tombstone: a photo written late for that session is then still known
   * to belong to an ended session instead of reviving it.
   */
  collectSession(sessionId: string, decide: CollectDecision): Promise<boolean>
}

export type CollectDecision = (record: SessionRecord | undefined) => { keepRecord: boolean } | null

function touchedRecord(record: SessionRecord | undefined, sessionId: string, now: number): SessionRecord {
  return record
    ? { ...record, lastActiveAt: Math.max(record.lastActiveAt, now) }
    : { id: sessionId, lastActiveAt: now, endedAt: null }
}

export function createMemoryBackend(): PhotoBackend {
  const photos = new Map<string, StoredPhoto>()
  const sessions = new Map<string, SessionRecord>()

  return {
    async putPhoto(photo) {
      photos.set(photo.id, photo)
      sessions.set(photo.sessionId, touchedRecord(sessions.get(photo.sessionId), photo.sessionId, photo.createdAt))
    },
    async getPhoto(id) {
      return photos.get(id)?.blob ?? null
    },
    async touchSession(sessionId, now) {
      sessions.set(sessionId, touchedRecord(sessions.get(sessionId), sessionId, now))
    },
    async markSessionEnded(sessionId, now) {
      const record = touchedRecord(sessions.get(sessionId), sessionId, now)
      sessions.set(sessionId, { ...record, endedAt: record.endedAt ?? now })
    },
    async listSessions() {
      return [...sessions.values()]
    },
    async listPhotoSessionIds() {
      return [...new Set([...photos.values()].map((photo) => photo.sessionId))]
    },
    async deletePhotos(ids) {
      ids.forEach((id) => photos.delete(id))
    },
    async collectSession(sessionId, decide) {
      const decision = decide(sessions.get(sessionId))
      if (!decision) return false
      for (const [id, photo] of photos) {
        if (photo.sessionId === sessionId) photos.delete(id)
      }
      if (!decision.keepRecord) sessions.delete(sessionId)
      return true
    },
  }
}

const DB_NAME = 'photobooth'
/** v1: photos only. v2: adds the bySession index and the sessions store. */
const DB_VERSION = 2
const PHOTOS = 'photos'
const SESSIONS = 'sessions'
const BY_SESSION = 'bySession'
/** A tab still running older code holds the v1 connection open until it reacts to versionchange. */
const OPEN_TIMEOUT_MS = 5000
/**
 * WebKit can leave a transaction hanging after the page was backgrounded. Every
 * photoStore mutation waits on the previous one, so a hung transaction would
 * stall saving, deleting and the kiosk busy marker for good.
 */
const TRANSACTION_TIMEOUT_MS = 15_000

function upgrade(request: IDBOpenDBRequest, oldVersion: number) {
  const database = request.result
  const transaction = request.transaction
  if (!transaction) return

  const photos = database.objectStoreNames.contains(PHOTOS)
    ? transaction.objectStore(PHOTOS)
    : database.createObjectStore(PHOTOS, { keyPath: 'id' })
  if (!photos.indexNames.contains(BY_SESSION)) photos.createIndex(BY_SESSION, 'sessionId')

  if (database.objectStoreNames.contains(SESSIONS)) return
  const sessions = database.createObjectStore(SESSIONS, { keyPath: 'id' })
  if (oldVersion === 0) return

  // v1 photos have no session record yet; their newest photo stands in for the last activity.
  const lastActive = new Map<string, number>()
  const cursorRequest = photos.openCursor()
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (cursor) {
      const photo = cursor.value as StoredPhoto
      lastActive.set(photo.sessionId, Math.max(lastActive.get(photo.sessionId) ?? 0, photo.createdAt))
      cursor.continue()
      return
    }
    lastActive.forEach((lastActiveAt, id) => sessions.put({ id, lastActiveAt, endedAt: null } satisfies SessionRecord))
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    let settled = false
    const timer = setTimeout(() => {
      settled = true
      reject(new Error('IDB_OPEN_TIMEOUT'))
    }, OPEN_TIMEOUT_MS)

    request.onupgradeneeded = (event) => upgrade(request, event.oldVersion)
    request.onsuccess = () => {
      clearTimeout(timer)
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      resolve(request.result)
    }
    request.onerror = () => {
      clearTimeout(timer)
      if (!settled) reject(request.error ?? new Error('IDB_OPEN_FAILED'))
      settled = true
    }
  })
}

type IndexedDbOpenResult =
  | { backend: PhotoBackend }
  /** This browser has no IndexedDB at all, so nothing was ever persisted. */
  | { backend: null; reason: 'unsupported' }
  /** IndexedDB exists but cannot be used right now (private mode, blocked, broken). */
  | { backend: null; reason: 'error' }

/** Opens the IndexedDB backend. Connections dropped later (iOS backgrounding, versionchange) reopen on next use. */
export async function openIndexedDbBackend(): Promise<IndexedDbOpenResult> {
  try {
    if (typeof indexedDB === 'undefined' || indexedDB === null) return { backend: null, reason: 'unsupported' }
  } catch {
    return { backend: null, reason: 'error' }
  }

  let connection: Promise<IDBDatabase> | null = null

  function getDatabase() {
    if (!connection) {
      const opening = openDatabase().then((database) => {
        const drop = () => {
          if (connection === opening) connection = null
        }
        database.onclose = drop
        database.onversionchange = () => {
          database.close()
          drop()
        }
        return database
      })
      opening.catch(() => {
        if (connection === opening) connection = null
      })
      connection = opening
    }
    return connection
  }

  /**
   * Runs `operate` inside one transaction and resolves with its result once the
   * transaction has committed; rejects (and drops the connection) if it aborts.
   */
  async function transact<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operate: (transaction: IDBTransaction, done: (value: T) => void) => void
  ): Promise<T> {
    const database = await getDatabase()
    return new Promise<T>((resolve, reject) => {
      let result: T
      let transaction: IDBTransaction
      try {
        transaction = database.transaction(storeNames, mode)
      } catch (error) {
        connection = null
        reject(error)
        return
      }
      const timer = setTimeout(() => {
        connection = null
        reject(new Error('IDB_TRANSACTION_TIMEOUT'))
        try {
          transaction.abort()
        } catch {
          // already finished
        }
      }, TRANSACTION_TIMEOUT_MS)
      transaction.oncomplete = () => {
        clearTimeout(timer)
        resolve(result)
      }
      // A failing request bubbles here before the transaction aborts, while
      // transaction.error is still null: report the request's own error
      // (e.g. QuotaExceededError) so callers can tell why it failed.
      transaction.onerror = (event) => {
        clearTimeout(timer)
        reject((event.target as IDBRequest | null)?.error ?? transaction.error ?? new Error('IDB_ERROR'))
      }
      transaction.onabort = () => {
        clearTimeout(timer)
        reject(transaction.error ?? new Error('IDB_ABORTED'))
      }
      try {
        operate(transaction, (value) => {
          result = value
        })
      } catch (error) {
        clearTimeout(timer)
        try {
          transaction.abort()
        } catch {
          // already finished
        }
        reject(error)
      }
    })
  }

  function touchInTransaction(transaction: IDBTransaction, sessionId: string, now: number) {
    const sessions = transaction.objectStore(SESSIONS)
    const request = sessions.get(sessionId)
    request.onsuccess = () => sessions.put(touchedRecord(request.result as SessionRecord | undefined, sessionId, now))
  }

  try {
    await getDatabase()
  } catch {
    return { backend: null, reason: 'error' }
  }

  const backend: PhotoBackend = {
    putPhoto(photo) {
      return transact<void>([PHOTOS, SESSIONS], 'readwrite', (transaction) => {
        transaction.objectStore(PHOTOS).put(photo)
        touchInTransaction(transaction, photo.sessionId, photo.createdAt)
      })
    },
    getPhoto(id) {
      return transact<Blob | null>([PHOTOS], 'readonly', (transaction, done) => {
        const request = transaction.objectStore(PHOTOS).get(id)
        request.onsuccess = () => {
          const blob = (request.result as StoredPhoto | undefined)?.blob
          done(blob instanceof Blob && blob.size > 0 ? blob : null)
        }
      })
    },
    touchSession(sessionId, now) {
      return transact<void>([SESSIONS], 'readwrite', (transaction) => touchInTransaction(transaction, sessionId, now))
    },
    markSessionEnded(sessionId, now) {
      return transact<void>([SESSIONS], 'readwrite', (transaction) => {
        const sessions = transaction.objectStore(SESSIONS)
        const request = sessions.get(sessionId)
        request.onsuccess = () => {
          const record = touchedRecord(request.result as SessionRecord | undefined, sessionId, now)
          sessions.put({ ...record, endedAt: record.endedAt ?? now })
        }
      })
    },
    listSessions() {
      return transact<SessionRecord[]>([SESSIONS], 'readonly', (transaction, done) => {
        const request = transaction.objectStore(SESSIONS).getAll()
        request.onsuccess = () => done(request.result as SessionRecord[])
      })
    },
    listPhotoSessionIds() {
      return transact<string[]>([PHOTOS], 'readonly', (transaction, done) => {
        const ids: string[] = []
        const request = transaction.objectStore(PHOTOS).index(BY_SESSION).openKeyCursor(null, 'nextunique')
        done(ids)
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) return
          ids.push(String(cursor.key))
          cursor.continue()
        }
      })
    },
    deletePhotos(ids) {
      return transact<void>([PHOTOS], 'readwrite', (transaction) => {
        const photos = transaction.objectStore(PHOTOS)
        ids.forEach((id) => photos.delete(id))
      })
    },
    collectSession(sessionId, decide) {
      return transact<boolean>([PHOTOS, SESSIONS], 'readwrite', (transaction, done) => {
        const photos = transaction.objectStore(PHOTOS)
        const sessions = transaction.objectStore(SESSIONS)
        done(false)
        const recordRequest = sessions.get(sessionId)
        recordRequest.onsuccess = () => {
          const decision = decide(recordRequest.result as SessionRecord | undefined)
          if (!decision) return
          const keysRequest = photos.index(BY_SESSION).getAllKeys(IDBKeyRange.only(sessionId))
          keysRequest.onsuccess = () => {
            keysRequest.result.forEach((key) => photos.delete(key))
            if (!decision.keepRecord) sessions.delete(sessionId)
            done(true)
          }
        }
      })
    },
  }

  return { backend }
}
