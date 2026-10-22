// One shared MediaStream for the camera screens. Ready and Capture are separate
// routes; holding the stream for a short grace period after the last screen
// releases it lets Capture reuse Ready's stream instead of re-requesting the
// camera (no second permission prompt, no black flash, never two live streams).
//
// Startup is watched: getUserMedia() cannot be aborted, and it can stay pending
// (unanswered permission prompt, a wedged camera driver, a very slow device).
// The manager therefore never races it away: the one request in flight is kept
// and followed until it settles, the UI only learns that it is overdue, and no
// second request is started while it is pending.

export type CameraErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'permission-denied'
  | 'not-found'
  | 'in-use'
  | 'disconnected'
  | 'unknown'

export class CameraError extends Error {
  readonly kind: CameraErrorKind

  constructor(kind: CameraErrorKind) {
    super(kind)
    this.kind = kind
    this.name = 'CameraError'
  }
}

export type CameraPhase =
  /** Nobody holds the camera and nothing is pending. */
  | { status: 'idle' }
  /** A request is in flight and still within its startup budget. */
  | { status: 'requesting' }
  /**
   * A request is in flight while the browser shows its permission prompt.
   * `overdue` once the prompt has stayed unanswered for two budgets: it may be
   * hidden (fullscreen kiosk) or answered while the camera itself hangs.
   */
  | { status: 'waiting-permission'; overdue: boolean }
  /** A request is in flight past its budget; it is still followed, never duplicated. */
  | { status: 'timed-out' }
  | { status: 'ready'; stream: MediaStream }
  | { status: 'failed'; kind: CameraErrorKind }

type TimerId = ReturnType<typeof setTimeout>

export type CameraManagerDeps = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  /** Why the camera can never work here (insecure page, no API), or null. */
  checkSupport?: () => CameraErrorKind | null
  /** Camera permission state, or null when the browser cannot tell. */
  queryPermission?: () => Promise<PermissionState | null>
  /** Startup time spent hidden does not count: background tabs are throttled. */
  isHidden?: () => boolean
  /** Registers for visibility changes; the budget restarts when the page is shown again. */
  onVisibilityChange?: (callback: () => void) => () => void
  setTimeout: (callback: () => void, ms: number) => TimerId
  clearTimeout: (id: TimerId) => void
  startupTimeoutMs?: number
  keepAliveMs?: number
}

export const CAMERA_STARTUP_TIMEOUT_MS = 12_000
const KEEP_ALIVE_MS = 1500

const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
}

export function classifyCameraError(error: unknown): CameraErrorKind {
  if (error instanceof CameraError) return error.kind

  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use'
    case 'TypeError':
    case 'NotSupportedError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function isLive(stream: MediaStream) {
  return stream.getVideoTracks().some((track) => track.readyState === 'live')
}

export function createCameraManager(deps: CameraManagerDeps) {
  const startupTimeoutMs = deps.startupTimeoutMs ?? CAMERA_STARTUP_TIMEOUT_MS
  const keepAliveMs = deps.keepAliveMs ?? KEEP_ALIVE_MS
  const listeners = new Set<(phase: CameraPhase) => void>()

  let phase: CameraPhase = { status: 'idle' }
  let stream: MediaStream | null = null
  let endedTrack: MediaStreamTrack | null = null
  /** The single getUserMedia chain in flight; never more than one. */
  let request: Promise<MediaStream> | null = null
  /** Budgets that expired with the permission prompt still unanswered. */
  let promptChecks = 0
  let holders = 0
  let stopTimer: TimerId | null = null
  let watchdog: TimerId | null = null

  function setPhase(next: CameraPhase) {
    phase = next
    listeners.forEach((listener) => listener(next))
  }

  function handleEnded() {
    if (!stream) return
    releaseStream()
    setPhase({ status: 'failed', kind: 'disconnected' })
  }

  function releaseStream() {
    if (!stream) return
    endedTrack?.removeEventListener('ended', handleEnded)
    endedTrack = null
    stopTracks(stream)
    stream = null
  }

  async function open(): Promise<MediaStream> {
    const unsupported = deps.checkSupport?.()
    if (unsupported) throw new CameraError(unsupported)

    try {
      return await deps.getUserMedia(PREFERRED_CONSTRAINTS)
    } catch (error) {
      const kind = classifyCameraError(error)
      // Looser constraints cannot fix a denied permission; only retry for device issues.
      if (kind === 'permission-denied') throw new CameraError(kind)
      // Sequential, never parallel: the first request has already settled here.
      try {
        return await deps.getUserMedia({ audio: false, video: true })
      } catch (fallbackError) {
        throw new CameraError(classifyCameraError(fallbackError))
      }
    }
  }

  function clearWatchdog() {
    if (watchdog) deps.clearTimeout(watchdog)
    watchdog = null
  }

  function armWatchdog() {
    clearWatchdog()
    watchdog = deps.setTimeout(handleBudgetExpired, startupTimeoutMs)
  }

  function handleBudgetExpired() {
    watchdog = null
    const current = request
    if (!current) return
    if (deps.isHidden?.()) {
      // Normally paused by the visibility hook already; never time out a hidden page.
      armWatchdog()
      return
    }
    // The prompt may have been answered (or dismissed) since the last check.
    const query = deps.queryPermission?.() ?? Promise.resolve(null)
    query
      .catch(() => null)
      .then((state) => {
        if (request !== current) return
        if (state === 'prompt') {
          promptChecks += 1
          setPhase({ status: 'waiting-permission', overdue: promptChecks >= 2 })
          if (promptChecks < 2) armWatchdog()
          return
        }
        setPhase({ status: 'timed-out' })
      })
  }

  // Hidden time does not count: pause the budget while hidden and restart it in
  // full once the page is visible again, unless the timeout was already shown.
  deps.onVisibilityChange?.(() => {
    if (!request) return
    if (deps.isHidden?.()) {
      clearWatchdog()
    } else if (!watchdog && (phase.status === 'requesting' || (phase.status === 'waiting-permission' && !phase.overdue))) {
      armWatchdog()
    }
  })

  function start() {
    promptChecks = 0
    setPhase({ status: 'requesting' })
    // Started hidden: the visibility hook arms the budget once the page is shown.
    if (!deps.isHidden?.() || !deps.onVisibilityChange) armWatchdog()

    const current = open()
    request = current
    deps
      .queryPermission?.()
      .then((state) => {
        // A visible prompt explains the wait at once; it is not a timeout.
        if (request === current && state === 'prompt' && phase.status === 'requesting') {
          setPhase({ status: 'waiting-permission', overdue: false })
        }
      })
      .catch(() => undefined)

    current.then(
      (opened) => {
        if (request !== current) return
        settle()
        if (holders === 0 && !stopTimer) {
          // Everyone left while it was pending (unmount, route change): never keep it.
          stopTracks(opened)
          setPhase({ status: 'idle' })
          return
        }
        // Within the keep-alive window it is kept like any stream, so a screen
        // that holds the camera again (Ready → Capture) does not prompt twice;
        // the pending stop timer releases it otherwise.
        stream = opened
        endedTrack = opened.getVideoTracks()[0] ?? null
        endedTrack?.addEventListener('ended', handleEnded)
        setPhase({ status: 'ready', stream: opened })
      },
      (error: unknown) => {
        if (request !== current) return
        settle()
        setPhase({ status: 'failed', kind: classifyCameraError(error) })
      }
    )
  }

  function settle() {
    request = null
    clearWatchdog()
  }

  function scheduleStop() {
    if (stopTimer) return
    stopTimer = deps.setTimeout(() => {
      stopTimer = null
      if (holders > 0) return
      releaseStream()
      // A pending request stops its own stream when it settles with no holders.
      if (!request) setPhase({ status: 'idle' })
    }, keepAliveMs)
  }

  return {
    getPhase: () => phase,

    subscribe(listener: (phase: CameraPhase) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /**
     * Keeps the camera open until the returned function is called (exactly
     * once is enough; extra calls are ignored). Starts a request when there is
     * neither a live stream nor one in flight, so a screen mounted after a
     * failure tries again by itself.
     */
    hold(): () => void {
      holders += 1
      if (stopTimer) {
        deps.clearTimeout(stopTimer)
        stopTimer = null
      }
      if (stream && !isLive(stream)) {
        releaseStream()
        setPhase({ status: 'idle' })
      }
      if (!stream && !request) start()

      let released = false
      return () => {
        if (released) return
        released = true
        holders = Math.max(0, holders - 1)
        if (holders === 0) scheduleStop()
      }
    },

    /**
     * Starts a new request after a failure. Refused (false) while a request is
     * still pending — getUserMedia cannot be cancelled, and a parallel request
     * would only queue a second prompt — or when nobody holds the camera.
     */
    retry(): boolean {
      if (request || holders === 0) return false
      if (stream && isLive(stream)) return true
      releaseStream()
      start()
      return true
    },

    /** Whether a request is still in flight (it may settle at any time). */
    isPending: () => request !== null,

    /** Counters for tests and diagnostics. */
    inspect: () => ({ holders, pending: request !== null, hasStream: stream !== null }),
  }
}

export type CameraManager = ReturnType<typeof createCameraManager>

let browserManager: CameraManager | null = null

/** The page-wide camera manager; created on first use (never during prerendering). */
export function getCameraManager(): CameraManager {
  if (!browserManager) {
    browserManager = createCameraManager({
      // Looked up on every call so the method is never detached from mediaDevices.
      getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      checkSupport: () => {
        if (!window.isSecureContext) return 'insecure'
        if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
        return null
      },
      queryPermission: async () => {
        try {
          return (await navigator.permissions.query({ name: 'camera' as PermissionName })).state
        } catch {
          // Firefox and older Safari cannot query camera permission.
          return null
        }
      },
      isHidden: () => document.visibilityState === 'hidden',
      onVisibilityChange: (callback) => {
        document.addEventListener('visibilitychange', callback)
        return () => document.removeEventListener('visibilitychange', callback)
      },
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (id) => clearTimeout(id),
    })
  }
  return browserManager
}
