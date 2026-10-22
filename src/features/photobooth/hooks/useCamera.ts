'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAMERA_STARTUP_TIMEOUT_MS,
  getCameraManager,
  type CameraErrorKind,
  type CameraPhase,
} from '@/src/features/photobooth/services/camera/cameraStream'

export type CameraState =
  | { status: 'starting' }
  /** The browser is showing its permission prompt; waiting is expected (until overdue). */
  | { status: 'waiting-permission'; overdue: boolean }
  /**
   * Startup is overdue: the request is still pending, or the stream arrived but
   * never started playing. Neither can be retried safely; it may still recover.
   */
  | { status: 'timed-out' }
  | { status: 'ready' }
  /** Stream is live but the browser refused to autoplay; needs a tap. */
  | { status: 'paused' }
  | { status: 'error'; kind: CameraErrorKind }

/** pending → playing; blocked = autoplay refused (needs a tap); stalled = play() never settled. */
type Playback = 'pending' | 'playing' | 'blocked' | 'stalled'

/** Frames should flow within this long after a stream is attached. */
const PLAYBACK_TIMEOUT_MS = CAMERA_STARTUP_TIMEOUT_MS / 2

function toState(phase: CameraPhase, playback: Playback): CameraState {
  switch (phase.status) {
    case 'ready':
      if (playback === 'playing') return { status: 'ready' }
      if (playback === 'blocked') return { status: 'paused' }
      return playback === 'stalled' ? { status: 'timed-out' } : { status: 'starting' }
    case 'failed':
      return { status: 'error', kind: phase.kind }
    case 'waiting-permission':
      return { status: 'waiting-permission', overdue: phase.overdue }
    case 'timed-out':
      return { status: 'timed-out' }
    default:
      return { status: 'starting' }
  }
}

/**
 * Attaches the shared camera stream to a <video>. Pass `enabled` only once the
 * screen is allowed to render (after route guards), and render the video
 * element in the same commit so the ref is set when the stream arrives.
 */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<CameraPhase>({ status: 'idle' })
  // Keyed by stream: a new stream never inherits the previous one's "playing".
  const [playback, setPlayback] = useState<{ stream: MediaStream | null; status: Playback }>({ stream: null, status: 'pending' })

  useEffect(() => {
    if (!enabled) return
    const manager = getCameraManager()
    const unsubscribe = manager.subscribe(setPhase)
    const release = manager.hold()
    setPhase(manager.getPhase())
    return () => {
      unsubscribe()
      release()
    }
  }, [enabled])

  const stream = phase.status === 'ready' ? phase.stream : null

  useEffect(() => {
    const video = videoRef.current
    if (!stream || !video) return
    let cancelled = false
    let settled = false
    const report = (status: Playback) => {
      if (!cancelled) setPlayback({ stream, status })
    }

    video.srcObject = stream
    // A stream whose frames never arrive leaves play() pending forever.
    const watchdog = window.setTimeout(() => {
      if (!settled) report('stalled')
    }, PLAYBACK_TIMEOUT_MS)
    video.play().then(
      () => {
        settled = true
        report('playing')
      },
      () => {
        settled = true
        report('blocked')
      }
    )

    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      video.srcObject = null
    }
  }, [stream])

  // Front cameras (and desktop webcams, which report no facing mode) are mirrored.
  const mirrored = stream?.getVideoTracks()[0]?.getSettings().facingMode !== 'environment'
  const state = toState(phase, playback.stream === stream ? playback.status : 'pending')

  /** Only does something when no request is pending; the UI hides Retry otherwise. */
  const retry = useCallback(() => {
    getCameraManager().retry()
  }, [])

  const resume = useCallback(async () => {
    const video = videoRef.current
    const current = video?.srcObject instanceof MediaStream ? video.srcObject : null
    try {
      await video?.play()
      setPlayback({ stream: current, status: 'playing' })
    } catch {
      setPlayback({ stream: current, status: 'blocked' })
    }
  }, [])

  /** Last resort for a request that never settles: a reload is the only way to drop it. */
  const reload = useCallback(() => window.location.reload(), [])

  // Recover by itself once the cause is fixed: permission granted in site
  // settings, or a camera plugged in. The Retry button stays available.
  const errorKind = state.status === 'error' ? state.kind : null
  useEffect(() => {
    if (!enabled || !errorKind) return
    let cancelled = false

    if (errorKind === 'permission-denied') {
      let permission: PermissionStatus | null = null
      navigator.permissions
        ?.query({ name: 'camera' as PermissionName })
        .then((status) => {
          if (cancelled) return
          permission = status
          status.onchange = () => {
            if (status.state === 'granted') retry()
          }
        })
        // Firefox and older Safari cannot query camera permission; Retry still works.
        .catch(() => undefined)
      return () => {
        cancelled = true
        if (permission) permission.onchange = null
      }
    }

    if (errorKind === 'not-found' || errorKind === 'disconnected') {
      const devices = navigator.mediaDevices
      devices?.addEventListener?.('devicechange', retry)
      return () => devices?.removeEventListener?.('devicechange', retry)
    }
  }, [enabled, errorKind, retry])

  return { videoRef, state, mirrored, retry, resume, reload }
}

export type CameraController = ReturnType<typeof useCamera>
