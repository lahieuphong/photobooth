// Pure idle rules for kiosk mode. "Busy" covers work the user started and is
// waiting for (a capture sequence, a PNG export): it never counts as idle.

export type IdlePhase =
  | { phase: 'active' }
  | { phase: 'warning'; remainingMs: number }
  | { phase: 'expired' }

export function getIdlePhase({
  now,
  lastActivityAt,
  busy,
  idleTimeoutMs,
  warningMs,
}: {
  now: number
  lastActivityAt: number
  busy: boolean
  idleTimeoutMs: number
  warningMs: number
}): IdlePhase {
  if (busy) return { phase: 'active' }

  // A clock that jumped backwards must not leave the session unexpirable.
  const idleMs = Math.max(0, now - lastActivityAt)
  if (idleMs >= idleTimeoutMs) return { phase: 'expired' }
  if (idleMs >= idleTimeoutMs - warningMs) return { phase: 'warning', remainingMs: idleTimeoutMs - idleMs }
  return { phase: 'active' }
}
