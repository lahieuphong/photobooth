import { parseSession, type PhotoboothSession } from '@/src/features/photobooth/domain/session'

// Session metadata is small JSON kept per tab. Photos live in photoStore.

const SESSION_KEY = 'photobooth.session.v2'
const NOTICE_KEY = 'photobooth.notice'
/** V1 stored package rounds and base64 photos here; it cannot be mapped to V2. */
const LEGACY_SESSION_KEYS = ['photobooth_runtime_session']

export type SessionNotice =
  /** The stored session was unreadable (old version, corrupted) and was dropped. */
  | 'session-reset'
  /** Another tab already works on this session; this tab let go of its copy. */
  | 'duplicate-tab'
  /** The previous session was ended and every one of its photos deleted. */
  | 'session-ended'
  /** The previous session was ended, but some photos could not be deleted yet. */
  | 'cleanup-incomplete'

const SESSION_NOTICES: SessionNotice[] = ['session-reset', 'duplicate-tab', 'session-ended', 'cleanup-incomplete']

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

type StoredSessionSnapshot = { session: PhotoboothSession | null; discarded: boolean; unavailable: boolean }

export function readStoredSession(): StoredSessionSnapshot {
  const storage = getStorage()
  if (!storage) return { session: null, discarded: false, unavailable: true }

  try {
    let discarded = false
    for (const key of LEGACY_SESSION_KEYS) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key)
        discarded = true
      }
    }

    const raw = storage.getItem(SESSION_KEY)
    if (raw === null) return { session: null, discarded, unavailable: false }

    try {
      const session = parseSession(JSON.parse(raw))
      if (session) return { session, discarded, unavailable: false }
    } catch {
      // Unreadable JSON is invalid data, distinct from an unavailable Storage API.
    }

    storage.removeItem(SESSION_KEY)
    return { session: null, discarded: true, unavailable: false }
  } catch {
    // Even obtaining Storage can succeed while getItem/removeItem throws (privacy settings).
    // Never treat a failed read as an empty session that is safe to replace.
    return { session: null, discarded: false, unavailable: true }
  }
}

/** Id of the stored session without any cleanup side effects (for background checks). */
export function peekStoredSessionId(): string | null {
  try {
    const raw = getStorage()?.getItem(SESSION_KEY) ?? null
    return raw === null ? null : parseSession(JSON.parse(raw))?.id ?? null
  } catch {
    return null
  }
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
  try {
    getStorage()?.setItem(NOTICE_KEY, notice)
  } catch {
    // A lost notice only hides an explanation; it never affects data.
  }
}

export function consumeSessionNotice(): SessionNotice | null {
  try {
    const storage = getStorage()
    const notice = storage?.getItem(NOTICE_KEY) ?? null
    storage?.removeItem(NOTICE_KEY)
    return SESSION_NOTICES.includes(notice as SessionNotice) ? (notice as SessionNotice) : null
  } catch {
    return null
  }
}
