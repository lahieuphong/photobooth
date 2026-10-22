// "Duplicate tab" copies sessionStorage, so two tabs can end up holding the same
// session id and would overwrite or delete each other's photos. A tab claims its
// session with a Web Lock for as long as the page lives; a second tab finding the
// lock taken lets go of its copy. Browsers without Web Locks skip the check.
//
// Held locks are also the strongest liveness signal available: the browser
// releases them when a tab closes or crashes, but not while a live tab is merely
// idle or throttled in the background. Garbage collection never removes a
// session whose lock is held, however old its heartbeat is.

/** The part of the Web Locks API this module uses (injectable for tests). */
export type LockManagerLike = {
  request(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<void> | undefined
  ): Promise<unknown>
  query(): Promise<{ held?: Array<{ name?: string }> }>
}

const LOCK_PREFIX = 'photobooth-session:'
/** A reload releases the old page's lock while the new page starts; give it a moment. */
const CLAIM_ATTEMPTS = 3
const CLAIM_RETRY_MS = 300

export function createSessionOwnership(getLocks: () => LockManagerLike | null, retryDelayMs = CLAIM_RETRY_MS) {
  const held = new Map<string, () => void>()
  /** Claimed while the Locks API was failing: owned as far as this tab can tell. */
  const unverifiable = new Set<string>()
  /** In-flight claims, so screens mounting together never compete with their own tab. */
  const pending = new Map<string, Promise<boolean>>()

  function tryLock(locks: LockManagerLike, sessionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      locks
        .request(`${LOCK_PREFIX}${sessionId}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(false)
            return undefined
          }
          resolve(true)
          return new Promise<void>((release) => {
            held.set(sessionId, release)
          })
        })
        // A failing Locks API must never block the photobooth.
        .catch(() => {
          unverifiable.add(sessionId)
          resolve(true)
        })
    })
  }

  async function claim(locks: LockManagerLike, sessionId: string) {
    // A tab works on one session at a time.
    for (const id of [...held.keys(), ...unverifiable]) {
      if (id !== sessionId) release(id)
    }

    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
      if (held.has(sessionId) || (await tryLock(locks, sessionId))) return true
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
    return false
  }

  function release(sessionId: string) {
    held.get(sessionId)?.()
    held.delete(sessionId)
    unverifiable.delete(sessionId)
  }

  return {
    /** True when this tab owns the session (or ownership cannot be checked). */
    claim(sessionId: string): Promise<boolean> {
      if (held.has(sessionId)) return Promise.resolve(true)
      const locks = getLocks()
      if (!locks) return Promise.resolve(true)

      let claiming = pending.get(sessionId)
      if (!claiming) {
        claiming = claim(locks, sessionId).finally(() => pending.delete(sessionId))
        pending.set(sessionId, claiming)
      }
      return claiming
    },

    release,

    /**
     * Whether this tab may keep the session alive. Without Web Locks a tab
     * cannot know, and the session it works on is treated as its own.
     */
    owns(sessionId: string): boolean {
      return getLocks() ? held.has(sessionId) || unverifiable.has(sessionId) : true
    },

    /** Sessions some tab currently holds; empty when it cannot be known. */
    async listLiveSessionIds(): Promise<Set<string>> {
      const locks = getLocks()
      if (!locks) return new Set()
      try {
        const { held: locksHeld = [] } = await locks.query()
        return new Set(
          locksHeld
            .map((lock) => lock.name ?? '')
            .filter((name) => name.startsWith(LOCK_PREFIX))
            .map((name) => name.slice(LOCK_PREFIX.length))
        )
      } catch {
        return new Set()
      }
    },
  }
}

const ownership = createSessionOwnership(() => {
  // Typed as always present, but missing in older browsers and outside secure contexts.
  const locks = typeof navigator === 'undefined' ? undefined : (navigator as { locks?: LockManager }).locks
  return locks ? (locks as unknown as LockManagerLike) : null
})

export const claimSession = ownership.claim
export const releaseSession = ownership.release
export const ownsSession = ownership.owns
export const listLiveSessionIds = ownership.listLiveSessionIds
