// "Duplicate tab" copies sessionStorage, so two tabs can end up holding the same
// session id and would overwrite or delete each other's photos. A tab claims its
// session with a Web Lock for as long as the page lives; a second tab finding the
// lock taken lets go of its copy. Browsers without Web Locks skip the check.

const held = new Map<string, () => void>()
/** A reload releases the old page's lock while the new page starts; give it a moment. */
const CLAIM_ATTEMPTS = 3
const CLAIM_RETRY_MS = 300

function lockName(sessionId: string) {
  return `photobooth-session:${sessionId}`
}

function tryLock(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks
      .request(lockName(sessionId), { ifAvailable: true }, (lock) => {
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
      .catch(() => resolve(true))
  })
}

/** In-flight claims, so screens mounting together never compete with their own tab. */
const pending = new Map<string, Promise<boolean>>()

async function claim(sessionId: string) {
  // A tab works on one session at a time.
  for (const id of [...held.keys()]) {
    if (id !== sessionId) releaseSession(id)
  }

  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    if (held.has(sessionId) || (await tryLock(sessionId))) return true
    await new Promise((resolve) => setTimeout(resolve, CLAIM_RETRY_MS))
  }
  return false
}

/** True when this tab owns the session (or ownership cannot be checked). */
export function claimSession(sessionId: string): Promise<boolean> {
  if (held.has(sessionId)) return Promise.resolve(true)
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return Promise.resolve(true)

  let claiming = pending.get(sessionId)
  if (!claiming) {
    claiming = claim(sessionId).finally(() => pending.delete(sessionId))
    pending.set(sessionId, claiming)
  }
  return claiming
}

export function releaseSession(sessionId: string) {
  held.get(sessionId)?.()
  held.delete(sessionId)
}
