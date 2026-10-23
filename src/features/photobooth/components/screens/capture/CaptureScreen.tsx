'use client'

import { Camera } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { describeReloadLoss, describeStorageRisk } from '@/src/features/photobooth/config/storageNotices'
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
  getReferencedPhotoIds,
  getShotsPerPress,
  isCaptureComplete,
  recordShot,
  releaseMissingShots,
  setRetakeDraft,
} from '@/src/features/photobooth/domain/session'
import { useCamera } from '@/src/features/photobooth/hooks/useCamera'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import { captureVideoFrameWithRetry } from '@/src/features/photobooth/services/camera/captureFrame'
import { beginBusy } from '@/src/features/photobooth/services/session/activity'
import {
  deletePhotos,
  getMemoryOnlyPhotos,
  getPhotoStoreStatus,
  savePhoto,
  type PhotoStoreStatus,
} from '@/src/features/photobooth/services/storage/photoStore'
import { readStoredSession } from '@/src/features/photobooth/services/storage/sessionStorage'
import { navigateWithFallback } from '@/src/features/photobooth/utils/navigation'

function isSessionReloadSafe() {
  const session = readStoredSession().session
  return !session || getMemoryOnlyPhotos(getReferencedPhotoIds(session)).length === 0
}

/** Marks a run that was cancelled or whose screen went away; not an error to show. */
class CaptureAborted extends Error {}

/** Pause between timed shots so people can read the next pose prompt. */
const BETWEEN_SHOTS_MS = 900
/** After this, a navigation that has not happened yet gets a manual link. */
const STUCK_NAVIGATION_MS = 2500

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
  if (error instanceof Error && error.message === 'CAPTURE_HIDDEN') {
    return 'Đã tạm dừng chụp vì màn hình bị ẩn. Ảnh đã chụp vẫn được giữ — bấm chụp để tiếp tục.'
  }
  if (error instanceof PhotoboothSessionError) {
    return 'Phiên chụp đã thay đổi ở nơi khác. Hãy tải lại trang.'
  }
  return 'Đã có lỗi khi chụp. Vui lòng thử lại.'
}

export default function CaptureScreen() {
  const router = useRouter()
  const { session, isLoaded, update, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.CAPTURE)
  const camera = useCamera(isLoaded)
  const { urls, isLoading: isLoadingPhotos, missingIds } = usePhotoUrls(session?.shots ?? [])
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [recoveredCount, setRecoveredCount] = useState(0)
  const [storageStatus, setStorageStatus] = useState<PhotoStoreStatus | null>(null)
  const [leavingTo, setLeavingTo] = useState<PhotoboothRoute | null>(null)
  const [isNavigationStuck, setIsNavigationStuck] = useState(false)
  const lockRef = useRef(false)
  const leavingRef = useRef(false)
  const aliveRef = useRef(true)
  /** The running press; cancelling it stops the loop and discards a photo still being saved. */
  const runRef = useRef<{ cancelled: boolean } | null>(null)
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

  useEffect(() => {
    if (!isLoaded) return
    void getPhotoStoreStatus().then(setStorageStatus)
  }, [isLoaded])

  // Earlier shots whose photo is gone (reload with memory-only storage) are
  // simply taken again: their slots become empty and the shutter fills them.
  const missingKey = missingIds.join('|')
  useEffect(() => {
    if (isBusy || isLoadingPhotos || !missingKey) return
    const missing = missingKey.split('|')
    const next = apply((current, now) => releaseMissingShots(current, missing, now), { deleteDropped: false })
    if (next) setRecoveredCount((count) => count + missing.length)
  }, [apply, isBusy, isLoadingPhotos, missingKey])

  useEffect(() => {
    if (!leavingTo) return
    const timer = window.setTimeout(() => setIsNavigationStuck(true), STUCK_NAVIGATION_MS)
    return () => window.clearTimeout(timer)
  }, [leavingTo])

  const leave = useCallback(
    (to: PhotoboothRoute) => {
      leavingRef.current = true
      lockRef.current = true
      setLeavingTo(to)
      navigateWithFallback(router, to, PHOTOBOOTH_ROUTES.CAPTURE, {
        // A reload is only safe while none of this session's photos live in memory alone.
        allowHardNavigation: isSessionReloadSafe(),
      })
    },
    [router]
  )

  const runCapture = useCallback(async () => {
    if (lockRef.current || !cameraReadyRef.current) return

    const initial = readStoredSession().session
    const firstTarget = initial ? getCaptureTarget(initial) : null
    if (!initial || !firstTarget) return

    lockRef.current = true
    const run = { cancelled: false }
    runRef.current = run
    const endBusy = beginBusy()
    setIsBusy(true)
    setError(null)

    const { isRetake } = firstTarget
    const { countdown } = initial
    const plannedShots = getShotsPerPress(initial)
    const checkpoint = () => {
      if (run.cancelled || !aliveRef.current) throw new CaptureAborted()
      if (document.visibilityState === 'hidden') throw new Error('CAPTURE_HIDDEN')
      if (!cameraReadyRef.current) throw new Error('CAMERA_LOST')
    }

    try {
      for (let shotsThisRun = 0; shotsThisRun < plannedShots; shotsThisRun += 1) {
        const latest = readStoredSession().session
        if (!latest) throw new PhotoboothSessionError('session missing')

        const target = getCaptureTarget(latest)
        if (!target || target.isRetake !== isRetake) break
        const { shotIndex } = target

        if (shotsThisRun > 0) {
          await wait(BETWEEN_SHOTS_MS)
          checkpoint()
        }

        for (let value = countdown; value >= 1; value -= 1) {
          checkpoint()
          setCountdownValue(value)
          await wait(1000)
        }
        checkpoint()
        setCountdownValue(null)
        setIsSaving(true)

        const blob = await captureVideoFrameWithRetry(camera.videoRef.current, { mirror: camera.mirrored })
        if (!blob) throw new Error('CAPTURE_FRAME_FAILED')
        if (run.cancelled) throw new CaptureAborted()
        setFlashKey((value) => value + 1)

        // The photo is stored before the session points at it. The shot was
        // taken (and flashed), so it is attached even if the screen unmounted
        // meanwhile; only an explicit cancel drops it. A photo that cannot be
        // attached is deleted right away instead of lingering as an orphan.
        const photoId = await savePhoto(latest.id, blob)
        try {
          if (run.cancelled) throw new CaptureAborted()
          update((current, now) =>
            isRetake ? setRetakeDraft(current, photoId, now) : recordShot(current, shotIndex, photoId, now)
          )
        } catch (attachError) {
          void deletePhotos([photoId])
          throw attachError
        }
        if (aliveRef.current) setIsSaving(false)
      }

      if (!aliveRef.current || run.cancelled) return
      const finished = readStoredSession().session
      if (!finished) throw new PhotoboothSessionError('session missing')

      if (isRetake) {
        if (finished.retake?.draftPhotoId) leave(PHOTOBOOTH_ROUTES.REVIEW)
      } else if (isCaptureComplete(finished)) {
        update((current, now) => completeCapture(current, now))
        leave(PHOTOBOOTH_ROUTES.REVIEW)
      }
    } catch (captureError) {
      if (aliveRef.current && !(captureError instanceof CaptureAborted)) setError(describeCaptureError(captureError))
    } finally {
      endBusy()
      if (runRef.current === run) runRef.current = null
      if (aliveRef.current) {
        setCountdownValue(null)
        setIsSaving(false)
        if (!leavingRef.current) {
          lockRef.current = false
          setIsBusy(false)
        }
      }
    }
  }, [camera.mirrored, camera.videoRef, leave, update])

  // Space / Enter act as the shutter for kiosks with a physical button or keyboard.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || (event.code !== 'Space' && event.code !== 'Enter')) return
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, dialog')) return
      event.preventDefault()
      void runCapture()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [runCapture])

  function handleCancelRetake() {
    if (leavingRef.current) return
    // Stops a running countdown at its next checkpoint; a draft still being
    // saved is discarded instead of attached.
    if (runRef.current) runRef.current.cancelled = true
    if (!apply((current, now) => cancelRetake(current, now))) return
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
  const memoryOnly = getMemoryOnlyPhotos(getReferencedPhotoIds(session))
  const shutterLabel = retake ? 'Chụp lại' : isTimed ? (getCapturedCount(session) > 0 ? 'Chụp tiếp' : 'Bắt đầu chụp') : 'Chụp'
  const hint = retake
    ? 'Ảnh mới chỉ thay ảnh cũ khi bạn xác nhận ở bước Xem lại.'
    : isTimed
      ? `Hẹn giờ ${session.countdown} giây · máy tự chụp các ảnh còn lại`
      : 'Bấm nút (hoặc phím cách) cho mỗi ảnh'
  const message = error ?? actionError
  const notes = [
    recoveredCount > 0 ? `${recoveredCount} ảnh trước không còn trên máy này nên sẽ được chụp bù.` : null,
    describeStorageRisk(storageStatus, memoryOnly),
  ].filter(Boolean)

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
            <CameraViewport camera={camera} filter={filter} slot={activeSlot} reloadNote={describeReloadLoss(memoryOnly)}>
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

        <div className="flex shrink-0 flex-col justify-center short:w-60">
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-1.5" aria-label="Tiến độ chụp">
            {session.shots.map((shot, index) => {
              const url = retake && index === retake.shotIndex ? null : urls[index]
              const isActive = index === activeShotIndex

              return (
                <div
                  key={index}
                  className={[
                    'relative h-11 w-11 overflow-hidden rounded-lg border transition-colors',
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
              className="group relative flex h-19.5 w-19.5 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_26px_rgba(255,90,42,0.35)] ring-[5px] ring-accent/20 transition-transform duration-200 ease-out-soft active:scale-95 disabled:opacity-45 disabled:shadow-none"
            >
              <Camera aria-hidden="true" size={30} strokeWidth={1.8} />
            </button>
            <p className="text-[14px] font-semibold">{leavingTo ? 'Đang chuyển…' : isBusy ? 'Đang chụp…' : shutterLabel}</p>
            <p role={message ? 'alert' : undefined} className={`text-center text-[12px] ${message ? 'text-danger' : 'text-muted'}`}>
              {message ?? hint}
            </p>
            {notes.map((note) => (
              <p key={note} className="text-center text-[12px] text-ink-soft">
                {note}
              </p>
            ))}
            {leavingTo && isNavigationStuck ? (
              <Link href={leavingTo} scroll={false} className="text-[13px] font-semibold text-ink underline underline-offset-2">
                Tiếp tục tới bước Xem lại
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}
