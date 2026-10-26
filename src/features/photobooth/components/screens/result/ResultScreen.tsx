'use client'

import { Download, PenLine, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import { CameraSticker, Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import MissingPhotosNotice from '@/src/features/photobooth/components/shared/feedback/MissingPhotosNotice'
import ScreenSkeleton, { PrintSkeleton } from '@/src/features/photobooth/components/shared/feedback/Skeletons'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { formatFrameDate, getFrame } from '@/src/features/photobooth/domain/frames'
import { PRINT_HEIGHT, PRINT_WIDTH, getLayout } from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, getLook, type PhotoboothLook } from '@/src/features/photobooth/domain/looks'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import { enterStudio, releaseMissingShots, setLook } from '@/src/features/photobooth/domain/session'
import { useNavigationLock } from '@/src/features/photobooth/hooks/useNavigationLock'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import {
  buildExportFileName,
  downloadBlob,
  renderCompositionPng,
} from '@/src/features/photobooth/services/export/canvasExport'
import { beginBusy } from '@/src/features/photobooth/services/session/activity'
import { endSession } from '@/src/features/photobooth/services/storage/photoStore'
import { releaseSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import { clearStoredSession, setSessionNotice } from '@/src/features/photobooth/services/storage/sessionStorage'
import { Confetti, ExportStatus, OtherLooks, RestartWarning, ResultDetails, type ExportState } from './ResultParts'

const SCREEN = PHOTOBOOTH_SCREENS.result

function describeExportError(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'PHOTO_MISSING' || code === 'PHOTO_DECODE_FAILED') {
    return 'Thiếu hoặc hỏng ảnh gốc trên máy này nên chưa tạo được ảnh. Hãy chụp lại ảnh bị thiếu.'
  }
  if (code === 'CANVAS_UNAVAILABLE' || code === 'EXPORT_ENCODE_FAILED') {
    return 'Trình duyệt không đủ bộ nhớ để tạo ảnh. Hãy đóng bớt tab khác rồi thử lại.'
  }
  return 'Không tạo được ảnh. Vui lòng thử lại.'
}

export default function ResultScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.RESULT)
  const { urls, isLoading, missingIds, unreadableIds, retry } = usePhotoUrls(session?.shots ?? [])
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false)
  const [isLeaving, setIsLeaving] = useNavigationLock()

  if (!isLoaded || !session) {
    return (
      <BrandPage>
        <main className="relative isolate flex min-h-full flex-col">
          <PastelBackdrop stableViewport />
          <FlowHeader screen={SCREEN} />
          <ScreenSkeleton screen="result" />
        </main>
      </BrandPage>
    )
  }

  const layout = getLayout(session.layoutId)
  const dateLabel = formatFrameDate(session.createdAt)
  const problemIds = [...missingIds, ...unreadableIds]
  const hasMissing = problemIds.length > 0
  const isOutputReady = !isLoading && !hasMissing && urls.filter(Boolean).length === session.shotCount
  const isExporting = exportState.status === 'working'
  const canExport = !isLoading && !hasMissing && !isExporting && !isLeaving

  async function handleDownload() {
    if (!session || !canExport) return
    setExportState({ status: 'working' })
    // An export in progress must not be interrupted by the kiosk idle timer.
    const endBusy = beginBusy()

    try {
      const png = await renderCompositionPng({
        layout,
        frameId: session.frameId,
        lookId: session.lookId,
        shots: session.shots,
        dateLabel,
      })
      const fileName = buildExportFileName(new Date())
      downloadBlob(png, fileName)
      setExportState({ status: 'done', fileName })
    } catch (error) {
      setExportState({ status: 'error', message: describeExportError(error) })
    } finally {
      endBusy()
    }
  }

  function handleEdit() {
    if (isLeaving || isExporting || !apply((current, now) => enterStudio(current, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.STUDIO, { scroll: false })
  }

  /** Same as "Chỉnh sửa lại", with another look already applied (setLook also reopens editing). */
  function handleTryLook(look: PhotoboothLook) {
    if (isLeaving || isExporting || !apply((current, now) => setLook(current, look.id, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.STUDIO, { scroll: false })
  }

  function handleRecover() {
    if (isLeaving || isExporting) return
    const next = apply((current, now) => releaseMissingShots(current, problemIds, now), { deleteDropped: false })
    if (!next) return
    setIsLeaving(true)
    router.push(getResumeRoute(next), { scroll: false })
  }

  async function handleRestart() {
    if (!session || isLeaving || isExporting) return
    if (!isConfirmingRestart) {
      setIsConfirmingRestart(true)
      return
    }
    setIsLeaving(true)
    const { complete } = await endSession(session.id).catch(() => ({ complete: false }))
    releaseSession(session.id)
    clearStoredSession()
    setSessionNotice(complete ? 'session-ended' : 'cleanup-incomplete')
    router.push(PHOTOBOOTH_ROUTES.EXPERIENCE, { scroll: false })
  }

  const isBusy = isLeaving || isExporting
  const otherLooks = PHOTOBOOTH_LOOKS.filter((look) => look.id !== session.lookId).slice(0, 4)

  return (
    <BrandPage>
      <main className="relative isolate min-h-full">
        <PastelBackdrop stableViewport />
        <FlowHeader screen={SCREEN} />

        <div
          // The print is sized from its own shape and a per-layout height cap.
          style={{ '--print-ratio': PRINT_WIDTH / PRINT_HEIGHT } as CSSProperties}
          className={[
            SITE_CONTAINER,
            'flex flex-col gap-5 pt-4 pb-10 [--print-max-h:46svh] sm:pt-5 sm:[--print-max-h:54svh]',
            'md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] md:grid-rows-[auto_1fr] md:items-start md:gap-x-8 md:[--print-max-h:min(calc(100svh-15rem),760px)]',
            'lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:gap-x-12 lg:[--print-max-h:min(calc(100svh-15rem),820px)]',
            'short:grid short:grid-cols-[minmax(0,calc(var(--print-max-h)*var(--print-ratio)+2rem))_minmax(0,1fr)] short:grid-rows-[auto_1fr] short:gap-x-6 short:gap-y-3 short:pt-2 short:[--print-max-h:calc(100svh-6rem)]',
          ].join(' ')}
        >
          <section aria-labelledby="result-title" className="relative text-center max-md:-order-2 sm:text-left md:col-start-2 md:row-start-1 short:col-start-2 short:row-start-1">
            {isOutputReady ? <Confetti /> : null}
            <BubbleHeading
              id="result-title"
              className={`${isOutputReady ? 'animate-pop' : ''} mx-auto font-bubble text-[clamp(40px,12vw,60px)] leading-[1.05] font-extrabold tracking-[-0.01em] text-accent sm:mx-0 lg:text-[clamp(56px,4.6vw,76px)] short:text-[34px]`}
              decorations={
                <>
                  <HeartSticker className="absolute top-[-0.1em] right-[-0.6em] w-[0.5em] rotate-12 animate-float" />
                  <Doodle className="absolute bottom-[0.05em] left-[-0.6em] hidden w-[0.45em] -scale-x-100 rotate-180 lg:block" />
                </>
              }
            >
              {isLoading ? 'Sắp xong…' : 'Tadaa!'}
            </BubbleHeading>
            <p className="motion-fade mt-1 font-bubble text-[clamp(19px,5.4vw,26px)] leading-tight font-bold text-cocoa short:text-[18px]">
              {isLoading ? 'Đang chuẩn bị ảnh của bạn…' : hasMissing ? 'Cần khôi phục ảnh gốc để hoàn thành.' : 'Tác phẩm của bạn đã hoàn thành!'}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft sm:max-w-110 sm:text-[15px] short:hidden">
              Tải về máy để lưu giữ và chia sẻ với bạn bè, hoặc thử một phong cách khác nhé!
            </p>
          </section>

          {/* The print is exactly the exported PNG: no tilt, tape or stickers on top of it (e2e compares them). */}
          <section
            aria-label="Ảnh hoàn chỉnh"
            aria-busy={isLoading}
            className="flex justify-center md:sticky md:top-4 md:col-start-1 md:row-span-2 md:row-start-1 short:col-start-1 short:row-span-2 short:row-start-1"
          >
            <div className={`${isOutputReady ? 'motion-paper' : ''} relative w-[min(100%,calc(var(--print-max-h)*var(--print-ratio)+2rem))]`}>
              <span
                aria-hidden="true"
                className="absolute -top-4 left-1/2 z-10 h-6 w-28 -translate-x-1/2 -rotate-3 rounded-[3px] short:hidden bg-[repeating-linear-gradient(45deg,rgb(245_191_204/0.9)_0_6px,rgb(253_230_235/0.9)_6px_12px)] shadow-[0_4px_8px_-4px_rgba(74,29,36,0.3)]"
              />
              <HeartSticker className="absolute top-[20%] -left-5 z-10 hidden w-10 -rotate-12 sm:block" />
              <StarSticker className="absolute top-[6%] -right-5 z-10 hidden w-9 sm:block" />
              <CameraSticker className="absolute -right-8 -bottom-7 z-10 hidden w-24 rotate-12 md:block" />
              <div className="rounded-[20px] bg-white p-4 shadow-[0_34px_70px_-34px_rgba(74,29,36,0.6)] ring-1 ring-blush-deep/50">
                <div className="relative">
                  <PhotoComposition
                    layoutId={session.layoutId}
                    frameId={session.frameId}
                    lookId={session.lookId}
                    photoUrls={urls}
                    dateLabel={dateLabel}
                    imageSizes="(max-width: 768px) 70vw, 520px"
                  />
                  {isLoading ? <PrintSkeleton layoutId={session.layoutId} photoUrls={urls} /> : null}
                </div>
              </div>
            </div>
          </section>

          {/* Joins the page column on phones (so the download bar can stick to the screen), its own column from md. */}
          <div className="contents md:col-start-2 md:row-start-2 md:flex md:min-w-0 md:animate-rise md:flex-col md:gap-4 md:[animation-delay:140ms] short:col-start-2 short:row-start-2 short:flex short:min-w-0 short:flex-col short:gap-3">
            {/* On phones it moves up under the heading: recovering is the only way forward then. */}
            {hasMissing ? (
              <div className="max-md:-order-1">
                <MissingPhotosNotice
                  missingCount={missingIds.length}
                  unreadableCount={unreadableIds.length}
                  onRecover={handleRecover}
                  onRetry={retry}
                  disabled={isBusy}
                />
              </div>
            ) : null}

            {/* Sticky on phones so saving is always one tap away; in flow, so it never covers anything. */}
            <div className="sticky bottom-0 z-20 -mx-4 border-t border-blush-deep/50 bg-petal/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <Button onClick={() => void handleDownload()} disabled={!canExport} variant="candy" size="lg" className="h-16 w-full text-[18px]">
                {isExporting ? (
                  <>
                    <span aria-hidden="true" className="size-5 animate-spin rounded-full border-[3px] border-white/35 border-t-white" />
                    Đang tạo ảnh…
                  </>
                ) : (
                  <>
                    <Download aria-hidden="true" size={20} />
                    Tải ảnh PNG
                  </>
                )}
              </Button>
            </div>
            <ExportStatus state={exportState} />

            {actionError ? (
              <p role="alert" className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-medium text-danger ring-1 ring-danger/30">
                {actionError}
              </p>
            ) : null}

            <ResultDetails
              shotCount={session.shotCount}
              layoutLabel={layout.label}
              experienceTitle={getExperience(session.experienceId).title}
              lookLabel={getLook(session.lookId).label}
              frameLabel={getFrame(session.frameId).label}
              dateLabel={dateLabel}
            />

            <OtherLooks
              looks={otherLooks}
              layoutId={session.layoutId}
              frameId={session.frameId}
              photoUrls={urls}
              dateLabel={dateLabel}
              disabled={isBusy || hasMissing}
              onPick={handleTryLook}
            />

            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Button variant="bubble" size="lg" onClick={handleEdit} disabled={isBusy} className="w-full px-5">
                <PenLine aria-hidden="true" size={17} />
                Chỉnh sửa lại
              </Button>
              <Button
                variant={isConfirmingRestart ? 'candy' : 'bubble'}
                size="lg"
                onClick={() => void handleRestart()}
                disabled={isBusy}
                className="w-full px-5"
              >
                <RotateCcw aria-hidden="true" size={17} />
                {isLeaving && isConfirmingRestart ? 'Đang xóa…' : isConfirmingRestart ? 'Xác nhận' : 'Chụp phiên mới'}
              </Button>
            </div>
            {isConfirmingRestart ? <RestartWarning onCancel={() => setIsConfirmingRestart(false)} disabled={isLeaving} /> : null}
          </div>
        </div>
      </main>
    </BrandPage>
  )
}
