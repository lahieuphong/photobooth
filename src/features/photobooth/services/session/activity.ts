// Last real user interaction for this tab, plus a count of running work the
// idle timer must wait for. The timestamp is mirrored to sessionStorage so a
// reload of an idle kiosk does not restart the idle clock.

const ACTIVITY_KEY = 'photobooth.activity'
const PERSIST_INTERVAL_MS = 10_000

let lastActivityAt: number | null = null
let lastPersistedAt = 0
let busyCount = 0

function readPersisted(): number | null {
  try {
    const value = Number(window.sessionStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function persist(at: number) {
  try {
    window.sessionStorage.setItem(ACTIVITY_KEY, String(at))
    lastPersistedAt = at
  } catch {
    // Without storage the clock simply restarts on reload.
  }
}

export function getLastActivityAt(now = Date.now()) {
  if (lastActivityAt === null) lastActivityAt = readPersisted() ?? now
  return lastActivityAt
}

export function recordActivity(now = Date.now()) {
  lastActivityAt = now
  if (now - lastPersistedAt >= PERSIST_INTERVAL_MS) persist(now)
}

export function isBusy() {
  return busyCount > 0
}

/** Marks work the idle timer must not interrupt; call the returned function exactly when it ends. */
export function beginBusy(): () => void {
  busyCount += 1
  let ended = false
  return () => {
    if (ended) return
    ended = true
    busyCount = Math.max(0, busyCount - 1)
    // Waiting for the work counted as attention: the idle clock restarts when it ends.
    recordActivity()
    persist(Date.now())
  }
}

/** Forgets the idle clock, e.g. after a session was ended. */
export function resetActivity(now = Date.now()) {
  lastActivityAt = now
  persist(now)
}
