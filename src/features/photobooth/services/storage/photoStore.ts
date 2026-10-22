import { getOrphanCutoffMs } from '@/src/features/photobooth/config/kiosk'
import {
  createMemoryBackend,
  openIndexedDbBackend,
  type CollectDecision,
  type PhotoBackend,
  type StoredPhoto,
} from './photoBackends'

// Original photos are stored as JPEG Blobs in IndexedDB instead of base64 in
// sessionStorage: a 6-shot session plus a retake draft can exceed the ~5MB Web
// Storage quota that is shared by every app on the github.io origin. When
// IndexedDB is unavailable (some private modes) or full, photos fall back to
// memory, which survives client-side navigation but not a reload.
//
// Deletion policy. Nothing here ever deletes "whatever the session does not
// reference", because that set is stale the moment a new photo is written:
//   1. Photos a session transition drops (replaced retake, cancelled draft) are
//      deleted by id — see deletePhotos().
//   2. Ending a session (reset, kiosk expiry) deletes every photo it owns.
//   3. Garbage collection only removes sessions that were ended or whose
//      record has not been touched for the orphan cutoff. Each tab's live
//      session touches its record, so other tabs are never collected. An
//      ended session keeps a tombstone record for the cutoff, so a photo that
//      lands late is still collected instead of reviving the session.
// Every mutation runs through one queue, so cleanups in this tab never overlap.

export type PhotoStoreStatus = {
  /** False once any photo had to be kept in memory; a full page reload would lose it. */
  persistent: boolean
  reason: 'ok' | 'unavailable' | 'quota' | 'error'
}

type OpenResult = { backend: PhotoBackend } | { backend: null; reason: 'unsupported' | 'error' }

type PhotoStoreOptions = {
  openPersistent: () => Promise<OpenResult>
  now?: () => number
  /** Sessions untouched for longer than this are abandoned (closed tab, crashed kiosk). */
  orphanCutoffMs?: () => number
}

/** Heartbeats closer together than this are skipped; the record only needs coarse liveness. */
const TOUCH_INTERVAL_MS = 15_000

function createPhotoId(sessionId: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${sessionId}:${random}`
}

export function isQuotaError(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError'
}

export function createPhotoStore({ openPersistent, now = Date.now, orphanCutoffMs = () => 24 * 60 * 60 * 1000 }: PhotoStoreOptions) {
  const memory = createMemoryBackend()
  let opened: Promise<OpenResult> | null = null
  let status: PhotoStoreStatus = { persistent: true, reason: 'ok' }
  let tail: Promise<unknown> = Promise.resolve()
  let gcRequest: { protectedIds: Set<string>; done: Promise<void> } | null = null
  const lastTouchAt = new Map<string, number>()

  /** Runs mutations one after another, in call order, even when one of them fails. */
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }

  function degrade(reason: Exclude<PhotoStoreStatus['reason'], 'ok'>) {
    if (status.persistent) status = { persistent: false, reason }
  }

  /** The persistent backend, or null with the reason; a failed open is retried on next use. */
  async function getPersistent(): Promise<OpenResult> {
    if (!opened) {
      opened = openPersistent().catch((): OpenResult => ({ backend: null, reason: 'error' }))
    }
    const result = await opened
    if (!result.backend && result.reason === 'error') opened = null
    return result
  }

  async function backends(): Promise<{ list: PhotoBackend[]; reachable: boolean }> {
    const result = await getPersistent()
    if (result.backend) return { list: [memory, result.backend], reachable: true }
    // 'unsupported' means nothing was ever persisted on this browser, so memory is the whole store.
    return { list: [memory], reachable: result.reason === 'unsupported' }
  }

  async function collectNow(protectedIds: Set<string>) {
    const cutoff = now() - orphanCutoffMs()
    const decide: CollectDecision = (record) => {
      if (!record || protectedIds.has(record.id)) return null
      if (record.endedAt !== null) return { keepRecord: record.endedAt >= cutoff }
      return record.lastActiveAt < cutoff ? { keepRecord: false } : null
    }

    for (const backend of (await backends()).list) {
      try {
        const records = await backend.listSessions()
        const known = new Set(records.map((record) => record.id))
        // Photos whose session has no record (written by a build without records):
        // start their grace period now instead of guessing they are abandoned.
        for (const sessionId of await backend.listPhotoSessionIds()) {
          if (!known.has(sessionId)) await backend.touchSession(sessionId, now())
        }
        for (const record of records) {
          if (decide(record)) await backend.collectSession(record.id, decide)
        }
      } catch {
        // Best effort: whatever was not collected now is collected on a later run.
      }
    }
  }

  async function putPersistent(backend: PhotoBackend, photo: StoredPhoto, protectedIds: Set<string>) {
    try {
      await backend.putPhoto(photo)
      return true
    } catch (error) {
      // Full: free abandoned sessions first. Otherwise retry once (the connection reopens).
      if (isQuotaError(error)) await collectNow(protectedIds)
      try {
        await backend.putPhoto(photo)
        return true
      } catch (retryError) {
        degrade(isQuotaError(retryError) ? 'quota' : 'error')
        return false
      }
    }
  }

  return {
    /**
     * Resolves with the new photo id only after it is stored, so callers can
     * safely point the session at it and navigate. Falls back to memory rather
     * than failing the capture; check getStatus() to warn about reloads.
     */
    savePhoto(sessionId: string, blob: Blob): Promise<string> {
      return serial(async () => {
        const photo: StoredPhoto = { id: createPhotoId(sessionId), sessionId, blob, createdAt: now() }
        const persistent = await getPersistent()

        if (persistent.backend && (await putPersistent(persistent.backend, photo, new Set([sessionId])))) {
          lastTouchAt.set(sessionId, photo.createdAt)
          return photo.id
        }
        if (!persistent.backend) degrade(persistent.reason === 'unsupported' ? 'unavailable' : 'error')

        await memory.putPhoto(photo)
        return photo.id
      })
    },

    /** The stored blob, or null when it is missing on this device. */
    async loadPhoto(id: string): Promise<Blob | null> {
      const inMemory = await memory.getPhoto(id)
      if (inMemory) return inMemory

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const persistent = await getPersistent()
          return persistent.backend ? await persistent.backend.getPhoto(id) : null
        } catch {
          // A dropped connection reopens on the second attempt.
        }
      }
      return null
    },

    /** Deletes photos a session transition no longer references. */
    deletePhotos(ids: string[]): Promise<boolean> {
      if (ids.length === 0) return Promise.resolve(true)
      return serial(async () => {
        const { list, reachable } = await backends()
        let complete = reachable
        for (const backend of list) {
          await backend.deletePhotos(ids).catch(() => {
            complete = false
          })
        }
        return complete
      })
    },

    /** Heartbeat that keeps other tabs' garbage collection away from this session. */
    touchSession(sessionId: string): Promise<void> {
      const at = now()
      if (at - (lastTouchAt.get(sessionId) ?? -Infinity) < TOUCH_INTERVAL_MS) return Promise.resolve()
      lastTouchAt.set(sessionId, at)
      return serial(async () => {
        for (const backend of (await backends()).list) {
          await backend.touchSession(sessionId, at).catch(() => undefined)
        }
      })
    },

    /**
     * Deletes every photo of the session (reset or expiry). `complete` is false
     * when some storage could not be reached; the session is still marked ended
     * where possible, so a later garbage collection finishes the job.
     */
    endSession(sessionId: string): Promise<{ complete: boolean }> {
      lastTouchAt.delete(sessionId)
      return serial(async () => {
        const { list, reachable } = await backends()
        let complete = reachable
        for (const backend of list) {
          try {
            await backend.markSessionEnded(sessionId, now())
          } catch {
            // Collection below may still succeed; if not, the abandoned cutoff applies.
          }
          try {
            await backend.collectSession(sessionId, () => ({ keepRecord: true }))
          } catch {
            complete = false
          }
        }
        return { complete }
      })
    },

    /**
     * Removes ended and abandoned sessions, never the protected ones (this tab's
     * session). Calls made while a run is still queued are merged into it.
     */
    collectGarbage(protectedIds: string[] = []): Promise<void> {
      if (gcRequest) {
        protectedIds.forEach((id) => gcRequest?.protectedIds.add(id))
        return gcRequest.done
      }
      const request = { protectedIds: new Set(protectedIds), done: Promise.resolve() }
      request.done = serial(() => {
        if (gcRequest === request) gcRequest = null
        return collectNow(request.protectedIds)
      })
      gcRequest = request
      return request.done
    },

    /** Probes storage once so screens can warn before the first photo is taken. */
    async getStatus(): Promise<PhotoStoreStatus> {
      const persistent = await getPersistent()
      if (!persistent.backend) degrade(persistent.reason === 'unsupported' ? 'unavailable' : 'error')
      return status
    },

    /** Synchronous view of the last known status. */
    peekStatus(): PhotoStoreStatus {
      return status
    },
  }
}

export type PhotoStore = ReturnType<typeof createPhotoStore>

const store = createPhotoStore({ openPersistent: openIndexedDbBackend, orphanCutoffMs: getOrphanCutoffMs })

export const savePhoto = store.savePhoto
export const loadPhoto = store.loadPhoto
export const deletePhotos = store.deletePhotos
export const touchSession = store.touchSession
export const endSession = store.endSession
export const collectGarbage = store.collectGarbage
export const getPhotoStoreStatus = store.getStatus

/** Whether every photo saved so far survives a full page reload. */
export function isPhotoStorePersistent() {
  return store.peekStatus().persistent
}
