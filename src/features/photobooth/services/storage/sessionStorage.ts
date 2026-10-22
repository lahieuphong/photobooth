import { parseSession, type PhotoboothSession } from '@/src/features/photobooth/domain/session'

// Session metadata is small JSON kept per tab. Photos live in photoStore.

const SESSION_KEY = 'photobooth.session.v2'
const NOTICE_KEY = 'photobooth.notice'
/** V1 stored package rounds and base64 photos here; it cannot be mapped to V2. */
const LEGACY_SESSION_KEYS = ['photobooth_runtime_session']

export type SessionNotice = 'session-reset'

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readStoredSession(): { session: PhotoboothSession | null; discarded: boolean } {
  const storage = getStorage()
  if (!storage) return { session: null, discarded: false }

  let discarded = false
  for (const key of LEGACY_SESSION_KEYS) {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key)
      discarded = true
    }
  }

  const raw = storage.getItem(SESSION_KEY)
  if (raw === null) return { session: null, discarded }

  try {
    const session = parseSession(JSON.parse(raw))
    if (session) return { session, discarded }
  } catch {
    // fall through: unreadable JSON is treated like an invalid session
  }

  storage.removeItem(SESSION_KEY)
  return { session: null, discarded: true }
}

export function writeStoredSession(session: PhotoboothSession) {
  const storage = getStorage()
  if (!storage) throw new Error('SESSION_STORAGE_UNAVAILABLE')
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  getStorage()?.removeItem(SESSION_KEY)
}

export function setSessionNotice(notice: SessionNotice) {
  getStorage()?.setItem(NOTICE_KEY, notice)
}

export function consumeSessionNotice(): SessionNotice | null {
  const storage = getStorage()
  const notice = storage?.getItem(NOTICE_KEY) ?? null
  storage?.removeItem(NOTICE_KEY)
  return notice === 'session-reset' ? notice : null
}
