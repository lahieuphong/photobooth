'use client'

import { Camera } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import CameraCard from '@/src/features/photobooth/components/shared/camera/CameraCard'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import ScreenSkeleton from '@/src/features/photobooth/components/shared/feedback/Skeletons'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { getExperience } from '@/src/features/photobooth/config/experiences'
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
import { CAPTURE_CARD_CLASS_NAME, CountdownOverlay, PoseGuide, ShotProgress, pad } from './CaptureParts'

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

const SCREEN = PHOTOBOOTH_SCREENS.capture

/** Placement per layout: stacked (phones), 2 columns (md), 3 columns (xl), sideways phones (short). */
const AREA = {
  prompt: 'order-1 md:col-start-2 md:row-start-1 short:col-start-2 short:row-start-1',
  camera:
    'order-2 md:col-start-1 md:row-span-6 md:row-start-1 xl:col-start-2 xl:row-span-4 xl:row-start-1 short:col-start-1 short:row-span-6 short:row-start-1',
  progress: 'order-3 md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1 short:col-start-2 short:row-start-2',
  shutter: 'order-4 md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-2 short:col-start-2 short:row-start-3',
  notes: 'order-5 md:col-start-2 md:row-start-4 xl:col-start-3 xl:row-start-3 short:col-start-2 short:row-start-4',
  poses: 'order-6 md:col-start-2 md:row-start-5 short:col-start-2 short:row-start-5',
}

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

  const cancelPendingCapture = useCallback(() => {
    if (runRef.current) runRef.current.cancelled = true
  }, [])

  const beginLeaving = useCallback((to: PhotoboothRoute) => {
    // A Link can keep this screen mounted while the next route loads. Cancel
    // before that transition starts, including a frame/save already in flight.
    cancelPendingCapture()
    leavingRef.current = true
    lockRef.current = true
    setCountdownValue(null)
    setLeavingTo(to)
  }, [cancelPendingCapture])

  useEffect(() => {
    cameraReadyRef.current = isCameraReady
  }, [isCameraReady])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      // Stops any running countdown/sequence loop at its next checkpoint.
      aliveRef.current = false
      cancelPendingCapture()
    }
  }, [cancelPendingCapture])

  useEffect(() => {
    function handleHistoryNavigation() {
      const path = window.location.pathname.replace(/\/+$/, '')
      if (path.endsWith(PHOTOBOOTH_ROUTES.CAPTURE)) return
      // Browser Back/Forward does not pass through the header's Link callback.
      cancelPendingCapture()
      leavingRef.current = true
      lockRef.current = true
    }
    window.addEventListener('popstate', handleHistoryNavigation)
    return () => window.removeEventListener('popstate', handleHistoryNavigation)
  }, [cancelPendingCapture])

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
      beginLeaving(to)
      navigateWithFallback(router, to, PHOTOBOOTH_ROUTES.CAPTURE, {
        // A reload is only safe while none of this session's photos live in memory alone.
        allowHardNavigation: isSessionReloadSafe(),
      })
    },
    [beginLeaving, router]
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
      if (run.cancelled || leavingRef.current || !aliveRef.current) throw new CaptureAborted()
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

        // The photo is stored before the session points at it. Leaving cancels
        // any pending attachment; shots already attached remain untouched.
        // A photo that cannot be attached is deleted instead of orphaned.
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
    cancelPendingCapture()
    if (!apply((current, now) => cancelRetake(current, now))) return
    leave(PHOTOBOOTH_ROUTES.REVIEW)
  }

  if (!isLoaded || !session) {
    return (
      <BrandPage>
        <main className="relative isolate flex min-h-full flex-col">
          <PastelBackdrop stableViewport />
          <FlowHeader screen={SCREEN} />
          <ScreenSkeleton screen="capture" />
        </main>
      </BrandPage>
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
  const isComplete = isCaptureComplete(session)
  const statusLine = leavingTo ? 'Đang chuyển…' : isBusy ? 'Đang chụp…' : shutterLabel
  const description =
    countdownValue !== null
      ? 'Giữ nguyên tư thế — máy sắp chụp!'
      : 'Giữ nguyên vị trí, nhìn vào camera và thể hiện biểu cảm tự nhiên nhé!'
  const notes = [
    recoveredCount > 0 ? `${recoveredCount} ảnh trước không còn trên máy này nên sẽ được chụp bù.` : null,
    describeStorageRisk(storageStatus, memoryOnly),
  ].filter(Boolean)

  return (
    <BrandPage>
      <main className="relative isolate min-h-full">
        <PastelBackdrop stableViewport />
        <FlowHeader screen={SCREEN} onBack={retake ? handleCancelRetake : undefined} backLabel={retake ? 'Hủy chụp lại' : undefined} onNavigate={beginLeaving} />

        <div
          // The camera card is sized from the active slot's shape and a per-layout height cap.
          style={{ '--camera-ratio': activeSlot.width / activeSlot.height } as CSSProperties}
          className={[
            SITE_CONTAINER,
            'flex flex-col gap-4 pt-3 pb-8 [--camera-max-h:46svh] sm:gap-5 sm:pt-5 sm:[--camera-max-h:54svh]',
            'md:grid md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] md:grid-rows-[auto_auto_auto_auto_auto_1fr] md:gap-x-6 md:gap-y-4 md:[--camera-max-h:min(64svh,720px)]',
            'lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-x-8 lg:[--camera-max-h:min(68svh,740px)]',
            'xl:grid-cols-[minmax(230px,290px)_minmax(0,1fr)_minmax(300px,340px)] xl:grid-rows-[auto_auto_auto_1fr] xl:gap-x-10',
            'short:grid short:grid-cols-[minmax(0,calc(var(--camera-max-h)*var(--camera-ratio)+1.5rem))_minmax(0,1fr)] short:grid-rows-[auto_auto_auto_auto_auto_1fr] short:gap-x-6 short:gap-y-3 short:pt-2 short:[--camera-max-h:calc(100svh-5.5rem)]',
          ].join(' ')}
        >
          {/* Its own column from xl; below that its children take part in the page grid. */}
          <div className="contents xl:col-start-1 xl:row-span-4 xl:row-start-1 xl:flex xl:flex-col xl:gap-5">
            <section aria-labelledby="capture-title" className={`text-center sm:text-left ${AREA.prompt}`}>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-deep uppercase">
                {retake ? `Chụp lại ảnh ${pad(activeShotIndex + 1)}` : 'Gợi ý tạo dáng'}
              </p>
              <BubbleHeading
                key={prompt}
                id="capture-title"
                className="mx-auto mt-1.5 animate-rise font-bubble text-[clamp(24px,7.4vw,34px)] leading-[1.12] font-extrabold tracking-[-0.01em] text-cocoa sm:mx-0 md:text-[34px] xl:text-[clamp(36px,3vw,48px)] short:mt-1 short:text-[24px]"
              >
                {prompt}
              </BubbleHeading>
              <p className="mt-2 hidden text-[14px] leading-relaxed text-ink-soft sm:block xl:text-[15px] short:hidden">{description}</p>
            </section>
            <div className={`animate-rise [animation-delay:160ms] ${AREA.poses}`}>
              <PoseGuide prompts={getExperience(session.experienceId).prompts} shots={session.shots} activeShotIndex={isComplete && !retake ? -1 : activeShotIndex} />
            </div>
          </div>

          <section aria-label="Camera" className={`motion-camera-enter [animation-delay:80ms] ${AREA.camera}`}>
            <CameraCard>
              <CameraViewport camera={camera} filter={filter} slot={activeSlot} reloadNote={describeReloadLoss(memoryOnly)}>
                {isCameraReady ? (
                  // Decorative: the shutter label and progress already say all of this.
                  <p
                    aria-hidden="true"
                    className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-bold tracking-[0.08em] text-cocoa uppercase shadow-[0_6px_14px_-6px_rgba(0,0,0,0.4)]"
                  >
                    <span className={`size-2.5 rounded-full ${isBusy ? 'bg-danger motion-safe:animate-pulse' : 'bg-success'}`} />
                    {isBusy ? 'Rec' : 'Sẵn sàng'} · Ảnh {pad(activeShotIndex + 1)}
                  </p>
                ) : null}

                {countdownValue !== null ? <CountdownOverlay value={countdownValue} /> : null}

                {flashKey > 0 ? (
                  <div key={flashKey} aria-hidden="true" className="animate-flash pointer-events-none absolute inset-0 bg-white" />
                ) : null}

                {isSaving ? (
                  <div className="absolute top-3 right-3 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-medium text-white">Đang lưu…</div>
                ) : null}
              </CameraViewport>
            </CameraCard>
          </section>

          <div className={`animate-rise [animation-delay:120ms] ${AREA.progress}`}>
            <ShotProgress
              layout={layout}
              shots={session.shots}
              urls={session.shots.map((_, index) => (retake && index === retake.shotIndex ? null : urls[index]))}
              activeShotIndex={activeShotIndex}
              isRetake={Boolean(retake)}
              isComplete={isComplete}
              filter={filter}
            />
          </div>

          {/* Sticky on phones so the shutter stays under the thumb; in flow, so it never covers content. */}
          <div
            className={`sticky bottom-0 z-20 -mx-4 flex items-center gap-4 border-t border-blush-deep/50 bg-petal/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8 md:static md:mx-0 md:flex-col md:gap-2 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none short:sticky short:mx-0 short:flex-row short:border-0 short:bg-petal/90 short:px-0 short:pt-2 short:pb-[max(8px,env(safe-area-inset-bottom))] short:backdrop-blur-md ${AREA.shutter}`}
          >
            <button
              type="button"
              onClick={() => void runCapture()}
              disabled={!isCameraReady || isBusy || Boolean(leavingTo)}
              aria-label={shutterLabel}
              className="group relative grid size-18 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#de5f7b] to-accent-deep text-white shadow-[0_5px_0_#8e2a43,0_16px_28px_-8px_rgba(176,58,85,0.6)] ring-[6px] ring-cream transition-[translate,box-shadow,opacity] duration-200 ease-out-soft hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-cocoa active:translate-y-1 active:shadow-[0_1px_0_#8e2a43] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none md:size-22 short:size-16"
            >
              <span className="grid size-[62%] place-items-center rounded-full bg-white/15 ring-2 ring-white/70">
                <Camera aria-hidden="true" size={28} strokeWidth={1.9} />
              </span>
            </button>
            <div className="min-w-0 flex-1 md:text-center short:text-left">
              <p className="font-bubble text-[17px] font-bold text-cocoa">{statusLine}</p>
              <p role={message ? 'alert' : undefined} className={`text-[12px] leading-snug ${message ? 'font-medium text-danger' : 'text-ink-soft'}`}>
                {message ?? hint}
              </p>
              {leavingTo && isNavigationStuck ? (
                <Link href={leavingTo} scroll={false} className="mt-1 inline-block text-[13px] font-semibold text-cocoa underline underline-offset-2">
                  Tiếp tục chuyển trang
                </Link>
              ) : null}
            </div>
          </div>

          {notes.length > 0 ? (
            <div className={`flex flex-col gap-2 ${AREA.notes}`}>
              {notes.map((note) => (
                <p key={note} className={`px-4 py-3 text-[13px] leading-snug text-ink-soft ${CAPTURE_CARD_CLASS_NAME}`}>
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </BrandPage>
  )
}
