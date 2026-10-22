// One shared MediaStream for the camera screens. Ready and Capture are separate
// routes; holding the stream for a short grace period after the last screen
// releases it lets Capture reuse Ready's stream instead of re-requesting the
// camera (no second permission prompt, no black flash, never two live streams).

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

const KEEP_ALIVE_MS = 1500

let activeStream: MediaStream | null = null
let pendingStream: Promise<MediaStream> | null = null
let holders = 0
let stopTimer: ReturnType<typeof setTimeout> | null = null

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

async function openStream(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) throw new CameraError('insecure')
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported')
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
  } catch (error) {
    const kind = classifyCameraError(error)
    // Looser constraints cannot fix a denied permission; only retry for device issues.
    if (kind === 'permission-denied') throw new CameraError(kind)

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    } catch (fallbackError) {
      throw new CameraError(classifyCameraError(fallbackError))
    }
  }
}

/** Every successful or failed call must be paired with releaseCameraStream(). */
export async function acquireCameraStream(): Promise<MediaStream> {
  holders += 1
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }

  if (activeStream && isLive(activeStream)) return activeStream
  if (activeStream) stopTracks(activeStream)
  activeStream = null

  // Concurrent callers share one getUserMedia request.
  if (!pendingStream) {
    pendingStream = openStream().finally(() => {
      pendingStream = null
    })
  }

  const stream = await pendingStream
  if (holders === 0) {
    stopTracks(stream)
    throw new CameraError('unknown')
  }

  activeStream = stream
  return stream
}

export function releaseCameraStream() {
  holders = Math.max(0, holders - 1)
  if (holders > 0 || stopTimer) return

  stopTimer = setTimeout(() => {
    stopTimer = null
    if (holders === 0 && activeStream) {
      stopTracks(activeStream)
      activeStream = null
    }
  }, KEEP_ALIVE_MS)
}
