// Original photos are stored as JPEG Blobs in IndexedDB instead of base64 in
// sessionStorage: a 6-shot session plus a retake draft can exceed the ~5MB Web
// Storage quota that is shared by every app on the github.io origin. When
// IndexedDB is unavailable (some private modes) photos fall back to memory,
// which survives client-side navigation but not a reload.

const DB_NAME = 'photobooth'
const DB_VERSION = 1
const STORE = 'photos'
/** Photos from other tabs/sessions older than this are treated as abandoned. */
const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000

type StoredPhoto = {
  id: string
  sessionId: string
  blob: Blob
  createdAt: number
}

const memoryStore = new Map<string, StoredPhoto>()
let databasePromise: Promise<IDBDatabase | null> | null = null
/** False once any photo had to be kept in memory; a full page reload would lose it. */
let isPersistent = true

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null)
          return
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE, { keyPath: 'id' })
        }
        request.onsuccess = () => {
          const database = request.result
          // iOS can drop the connection while the app is backgrounded; reopen on next use.
          database.onclose = () => {
            databasePromise = null
          }
          database.onversionchange = () => {
            database.close()
            databasePromise = null
          }
          resolve(database)
        }
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  return databasePromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase()
  if (!database) return null

  const transaction = database.transaction(STORE, mode)
  const completed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  const [value] = await Promise.all([requestToPromise(run(transaction.objectStore(STORE))), completed])
  return { value }
}

function createPhotoId(sessionId: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${sessionId}:${random}`
}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

async function putPhoto(photo: StoredPhoto) {
  return (await withStore('readwrite', (store) => store.put(photo))) !== null
}

/**
 * Resolves only after the photo is stored, so callers can safely navigate. A
 * failed write is retried once on a fresh connection, then kept in memory;
 * only a full quota is reported to the caller.
 */
export async function savePhoto(sessionId: string, blob: Blob): Promise<string> {
  const photo: StoredPhoto = { id: createPhotoId(sessionId), sessionId, blob, createdAt: Date.now() }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (await putPhoto(photo)) return photo.id
      break
    } catch (error) {
      if (isQuotaError(error)) throw error
      databasePromise = null
    }
  }

  memoryStore.set(photo.id, photo)
  isPersistent = false
  return photo.id
}

/** Whether every saved photo survives a full page reload. */
export function isPhotoStorePersistent() {
  return isPersistent
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  const inMemory = memoryStore.get(id)
  if (inMemory) return inMemory.blob

  try {
    const stored = await withStore<StoredPhoto | undefined>('readonly', (store) => store.get(id))
    return stored?.value?.blob ?? null
  } catch {
    databasePromise = null
    return null
  }
}

async function listPhotos(): Promise<StoredPhoto[]> {
  const stored = await withStore<StoredPhoto[]>('readonly', (store) => store.getAll())
  return [...(stored?.value ?? []), ...memoryStore.values()]
}

async function deletePhotos(ids: string[]) {
  for (const id of ids) {
    memoryStore.delete(id)
    await withStore('readwrite', (store) => store.delete(id))
  }
}

/**
 * Deletes photos this session no longer references (replaced retakes, cancelled
 * drafts) and photos abandoned by older sessions. Other recent sessions are kept
 * so a second tab is not wiped.
 */
export async function prunePhotos(sessionId: string, referencedIds: string[]) {
  const keep = new Set(referencedIds)
  const cutoff = Date.now() - ABANDONED_AFTER_MS
  const photos = await listPhotos()
  await deletePhotos(
    photos
      .filter((photo) =>
        photo.sessionId === sessionId ? !keep.has(photo.id) : photo.createdAt < cutoff
      )
      .map((photo) => photo.id)
  )
}

export async function deleteSessionPhotos(sessionId: string) {
  const photos = await listPhotos()
  await deletePhotos(photos.filter((photo) => photo.sessionId === sessionId).map((photo) => photo.id))
}
