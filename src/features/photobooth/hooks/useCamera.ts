'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireCameraStream,
  classifyCameraError,
  releaseCameraStream,
  type CameraErrorKind,
} from '@/src/features/photobooth/services/camera/cameraStream'

export type CameraState =
  | { status: 'starting' }
  | { status: 'ready' }
  /** Stream is live but the browser refused to autoplay; needs a tap. */
  | { status: 'paused' }
  | { status: 'error'; kind: CameraErrorKind }

/**
 * Attaches the shared camera stream to a <video>. Pass `enabled` only once the
 * screen is allowed to render (after route guards), and render the video
 * element in the same commit so the ref is set when the effect runs.
 */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<CameraState>({ status: 'starting' })
  const [mirrored, setMirrored] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!enabled || !video) return

    let cancelled = false
    let track: MediaStreamTrack | null = null

    const handleEnded = () => {
      if (!cancelled) setState({ status: 'error', kind: 'disconnected' })
    }

    setState({ status: 'starting' })

    acquireCameraStream()
      .then(async (stream) => {
        if (cancelled) return

        track = stream.getVideoTracks()[0] ?? null
        track?.addEventListener('ended', handleEnded)
        // Front cameras (and desktop webcams, which report no facing mode) are mirrored.
        setMirrored(track?.getSettings().facingMode !== 'environment')

        video.srcObject = stream
        try {
          await video.play()
          if (!cancelled) setState({ status: 'ready' })
        } catch {
          if (!cancelled) setState({ status: 'paused' })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', kind: classifyCameraError(error) })
      })

    return () => {
      cancelled = true
      track?.removeEventListener('ended', handleEnded)
      video.srcObject = null
      releaseCameraStream()
    }
  }, [enabled, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const resume = useCallback(async () => {
    try {
      await videoRef.current?.play()
      setState({ status: 'ready' })
    } catch {
      setState({ status: 'paused' })
    }
  }, [])

  return { videoRef, state, mirrored, retry, resume }
}

export type CameraController = ReturnType<typeof useCamera>
