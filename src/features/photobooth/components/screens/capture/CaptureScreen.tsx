'use client'

import { Camera } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import {
  PhotoboothSessionError,
  cancelRetake,
  completeCapture,
  getCaptureTarget,
  getCapturedCount,
  getExperiencePrompt,
  getNextShotIndex,
  getShotsPerPress,
  isCaptureComplete,
  recordShot,
  setRetakeDraft,
} from '@/src/features/photobooth/domain/session'
import { useCamera } from '@/src/features/photobooth/hooks/useCamera'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import { captureVideoFrameWithRetry } from '@/src/features/photobooth/services/camera/captureFrame'
import { isPhotoStorePersistent, savePhoto } from '@/src/features/photobooth/services/storage/photoStore'
import { readStoredSession } from '@/src/features/photobooth/services/storage/sessionStorage'
import { navigateWithFallback } from '@/src/features/photobooth/utils/navigation'

/** Pause between timed shots so people can read the next pose prompt. */
const BETWEEN_SHOTS_MS = 900

const pad = (value: number) => String(value).padStart(2, '0')

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function describeCaptureError(error: unknown) {
  if (error instanceof Error && error.message === 'CAPTURE_FRAME_FAILED') {
    return 'Không lấy được hình từ camera. Giữ yên một chút rồi thử lại.'
  }
  if (error instanceof Error && error.message === 'CAMERA_LOST') {
    return 'Camera vừa bị ngắt nên đã dừng chụp. Ảnh đã chụp vẫn được giữ.'
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Không lưu được ảnh vì bộ nhớ trình duyệt đã đầy.'
  }
  if (error instanceof PhotoboothSessionError) {
    return 'Phiên chụp đã thay đổi ở nơi khác. Hãy tải lại trang.'
  }
  return 'Đã có lỗi khi chụp. Vui lòng thử lại.'
}

export default function CaptureScreen() {
  const router = useRouter()
  const { session, isLoaded, update } = usePhotoboothSession(PHOTOBOOTH_ROUTES.CAPTURE)
  const camera = useCamera(isLoaded)
  const { urls } = usePhotoUrls(session?.shots ?? [])
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef(false)
  const leavingRef = useRef(false)
  const aliveRef = useRef(true)
  const isCameraReady = camera.state.status === 'ready'
  // Read inside the capture loop: a camera that drops mid-sequence must stop it.
  const cameraReadyRef = useRef(isCameraReady)

  useEffect(() => {
    cameraReadyRef.current = isCameraReady
  }, [isCameraReady])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      // Stops any running countdown/sequence loop at its next checkpoint.
      aliveRef.current = false
    }
  }, [])

  const leave = useCallback(
    (to: PhotoboothRoute) => {
      leavingRef.current = true
      lockRef.current = true
      navigateWithFallback(router, to, PHOTOBOOTH_ROUTES.CAPTURE, {
        allowHardNavigation: isPhotoStorePersistent(),
      })
    },
    [router]
  )

  const runCapture = useCallback(async () => {
    if (lockRef.current || !isCameraReady) return

    const initial = readStoredSession().session
    if (!initial) return

    lockRef.current = true
    setIsBusy(true)
    setError(null)

    const isRetake = initial.retake !== null
    const { countdown } = initial
    const plannedShots = getShotsPerPress(initial)

    try {
      for (let shotsThisRun = 0; shotsThisRun < plannedShots && aliveRef.current; shotsThisRun += 1) {
        const latest = readStoredSession().session
        if (!latest) throw new PhotoboothSessionError('session missing')

        const target = getCaptureTarget(latest)
        if (!target || target.isRetake !== isRetake) break
        const { shotIndex } = target

        if (shotsThisRun > 0) {
          await wait(BETWEEN_SHOTS_MS)
          if (!aliveRef.current) return
        }

        for (let value = countdown; value >= 1; value -= 1) {
          if (!cameraReadyRef.current) throw new Error('CAMERA_LOST')
          setCountdownValue(value)
          await wait(1000)
          if (!aliveRef.current) return
        }
        if (!cameraReadyRef.current) throw new Error('CAMERA_LOST')
        setCountdownValue(null)
        setIsSaving(true)

        const blob = await captureVideoFrameWithRetry(camera.videoRef.current, { mirror: camera.mirrored })
        if (!blob) throw new Error('CAPTURE_FRAME_FAILED')
        setFlashKey((value) => value + 1)

        // The photo is durably stored before the session points at it; an
        // interrupted write leaves an orphan that the next prune removes.
        const photoId = await savePhoto(latest.id, blob)
        if (!aliveRef.current) return

        update((current, now) =>
          isRetake ? setRetakeDraft(current, photoId, now) : recordShot(current, shotIndex, photoId, now)
        )
        setIsSaving(false)
      }

      const finished = readStoredSession().session
      if (!finished) throw new PhotoboothSessionError('session missing')

      if (isRetake) {
        if (finished.retake?.draftPhotoId) leave(PHOTOBOOTH_ROUTES.REVIEW)
      } else if (isCaptureComplete(finished)) {
        update((current, now) => completeCapture(current, now))
        leave(PHOTOBOOTH_ROUTES.REVIEW)
      }
    } catch (captureError) {
      if (aliveRef.current) setError(describeCaptureError(captureError))
    } finally {
      if (aliveRef.current) {
        setCountdownValue(null)
        setIsSaving(false)
        if (!leavingRef.current) {
          lockRef.current = false
          setIsBusy(false)
        }
      }
    }
  }, [camera.mirrored, camera.videoRef, isCameraReady, leave, update])

  // Space / Enter act as the shutter for kiosks with a physical button or keyboard.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || (event.code !== 'Space' && event.code !== 'Enter')) return
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input')) return
      event.preventDefault()
      void runCapture()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [runCapture])

  function handleCancelRetake() {
    if (leavingRef.current) return
    // Stops a running countdown at its next checkpoint; a photo saved in flight
    // is never attached to the session and gets pruned.
    aliveRef.current = false
    update((current, now) => cancelRetake(current, now))
    leave(PHOTOBOOTH_ROUTES.REVIEW)
  }

  if (!isLoaded || !session) {
    return (
      <ScreenShell>
        <ScreenHeader screen={PHOTOBOOTH_SCREENS.capture} />
        <Spinner className="flex-1" />
      </ScreenShell>
    )
  }

  const retake = session.retake
  const activeShotIndex = retake ? retake.shotIndex : Math.max(0, getNextShotIndex(session))
  const prompt = getExperiencePrompt(session, activeShotIndex)
  const layout = getLayout(session.layoutId)
  const activeSlot = layout.slots.find((slot) => slot.shotIndex === activeShotIndex) ?? layout.slots[0]
  const filter = toCssFilter(getLook(session.lookId))
  const isTimed = session.countdown > 0
  const shutterLabel = retake ? 'Chụp lại' : isTimed ? (getCapturedCount(session) > 0 ? 'Chụp tiếp' : 'Bắt đầu chụp') : 'Chụp'
  const hint = retake
    ? 'Ảnh mới chỉ thay ảnh cũ khi bạn xác nhận ở bước Xem lại.'
    : isTimed
      ? `Hẹn giờ ${session.countdown} giây · máy tự chụp các ảnh còn lại`
      : 'Bấm nút (hoặc phím cách) cho mỗi ảnh'

  return (
    <ScreenShell>
      <ScreenHeader
        screen={PHOTOBOOTH_SCREENS.capture}
        onBack={retake ? handleCancelRetake : undefined}
        backLabel={retake ? 'Hủy chụp lại' : undefined}
      />

      <div className="flex min-h-0 flex-1 flex-col short:flex-row short:gap-6">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mt-1 flex shrink-0 items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                {retake ? `Chụp lại ảnh ${pad(activeShotIndex + 1)}` : 'Gợi ý tạo dáng'}
              </p>
              <p key={prompt} className="animate-rise mt-1 truncate font-display text-[clamp(22px,4.6vw,36px)] italic leading-tight">
                “{prompt}”
              </p>
            </div>
            <p className="shrink-0 font-display text-[clamp(28px,6vw,48px)] font-light tabular-nums leading-none" aria-live="polite">
              {pad(activeShotIndex + 1)}
              <span className="text-muted"> / {pad(session.shotCount)}</span>
            </p>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <CameraViewport camera={camera} filter={filter} slot={activeSlot}>
              {countdownValue !== null ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span
                    key={countdownValue}
                    className="animate-pop font-display text-[clamp(96px,26cqh,220px)] font-light leading-none text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                  >
                    {countdownValue}
                  </span>
                </div>
              ) : null}

              {flashKey > 0 ? (
                <div key={flashKey} aria-hidden="true" className="animate-flash pointer-events-none absolute inset-0 bg-white" />
              ) : null}

              {isSaving ? (
                <div className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-medium text-white">
                  Đang lưu…
                </div>
              ) : null}
            </CameraViewport>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-center short:w-[240px]">
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-1.5" aria-label="Tiến độ chụp">
            {session.shots.map((shot, index) => {
              const url = retake && index === retake.shotIndex ? null : urls[index]
              const isActive = index === activeShotIndex

              return (
                <div
                  key={index}
                  className={[
                    'relative h-11 w-11 overflow-hidden rounded-[8px] border transition-colors',
                    isActive ? 'border-accent' : 'border-line',
                    shot ? 'bg-paper-deep' : 'bg-white',
                  ].join(' ')}
                >
                  {url ? (
                    <Image src={url} alt="" fill unoptimized sizes="44px" className="object-cover" style={{ filter }} />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-muted">
                      {pad(index + 1)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void runCapture()}
              disabled={!isCameraReady || isBusy}
              aria-label={shutterLabel}
              className="group relative flex h-[78px] w-[78px] items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_26px_rgba(255,90,42,0.35)] ring-[5px] ring-accent/20 transition-transform duration-200 ease-out-soft active:scale-95 disabled:opacity-45 disabled:shadow-none"
            >
              <Camera aria-hidden="true" size={30} strokeWidth={1.8} />
            </button>
            <p className="text-[14px] font-semibold">{isBusy ? 'Đang chụp…' : shutterLabel}</p>
            <p role={error ? 'alert' : undefined} className={`text-center text-[12px] ${error ? 'text-danger' : 'text-muted'}`}>
              {error ?? hint}
            </p>
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}
