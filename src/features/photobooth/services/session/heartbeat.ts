// Session liveness, independent of user activity. An open tab that owns a
// session refreshes the session's storage record on a timer, so other tabs'
// garbage collection never mistakes "nobody touched the screen for a while"
// for "nobody uses these photos any more".
//
// It is deliberately not user activity: it never feeds the kiosk idle timer,
// so a kiosk session still expires on schedule while the heartbeat runs.
//
// Limits, by design of browsers: a hidden tab's timers are throttled and a
// frozen or discarded tab runs no code at all, so a heartbeat can go stale for
// a tab that still exists. The ownership lock (sessionOwnership) covers live
// but frozen tabs; the beat on resume refreshes the record as soon as the tab
// runs again.

export const HEARTBEAT_INTERVAL_MS = 60_000

type IntervalId = ReturnType<typeof setInterval>

export type HeartbeatDeps = {
  /** The session this tab works on right now, or null (none, or it was ended). */
  getSessionId: () => string | null
  /** Only a session this tab owns is kept alive; a duplicated tab's copy is not. */
  owns: (sessionId: string) => boolean
  touch: (sessionId: string) => void
  setInterval: (callback: () => void, ms: number) => IntervalId
  clearInterval: (id: IntervalId) => void
  /** Registers a callback for "the page runs again" events; returns the unsubscribe. */
  onResume?: (callback: () => void) => () => void
  intervalMs?: number
}

/** Starts beating at once and on every interval and resume; returns stop(). */
export function startSessionHeartbeat(deps: HeartbeatDeps): () => void {
  const beat = () => {
    const sessionId = deps.getSessionId()
    if (sessionId && deps.owns(sessionId)) deps.touch(sessionId)
  }

  beat()
  const timer = deps.setInterval(beat, deps.intervalMs ?? HEARTBEAT_INTERVAL_MS)
  const stopResume = deps.onResume?.(beat)

  return () => {
    deps.clearInterval(timer)
    stopResume?.()
  }
}

/** Visible again, restored from the back/forward cache, or unfrozen (Page Lifecycle API). */
export function onPageResume(callback: () => void): () => void {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') callback()
  }
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pageshow', callback)
  document.addEventListener('resume', callback)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pageshow', callback)
    document.removeEventListener('resume', callback)
  }
}
