'use client'

import { ArrowRight, Camera, Clock, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import { Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { SESSION_NOTICE_COPY } from '@/src/features/photobooth/config/sessionNotices'
import { describeReloadLoss, describeStorageRisk } from '@/src/features/photobooth/config/storageNotices'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import {
  PHOTOBOOTH_COUNTDOWN_OPTIONS,
  getCapturedCount,
  getReferencedPhotoIds,
  markReady,
  releaseMissingShots,
  type PhotoboothCountdown,
} from '@/src/features/photobooth/domain/session'
import { useCamera, type CameraState } from '@/src/features/photobooth/hooks/useCamera'
import { useNavigationLock } from '@/src/features/photobooth/hooks/useNavigationLock'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import {
  getMemoryOnlyPhotos,
  getPhotoStoreStatus,
  type PhotoStoreStatus,
} from '@/src/features/photobooth/services/storage/photoStore'
import { consumeSessionNotice } from '@/src/features/photobooth/services/storage/sessionStorage'
import { PresetSummary, READY_CARD_CLASS_NAME, ReadyPerks, ReadyTips } from './ReadyParts'

const SCREEN = PHOTOBOOTH_SCREENS.ready

const STATUS_COPY = {
  starting: 'Đang mở camera…',
  'waiting-permission': 'Đang chờ bạn cho phép dùng camera',
  'timed-out': 'Camera phản hồi quá lâu',
  ready: 'Camera đã sẵn sàng',
  paused: 'Chạm vào khung hình để bật camera',
  error: 'Camera chưa sẵn sàng',
} as const

const STATUS_DOT: Record<CameraState['status'], string> = {
  starting: 'bg-sunny motion-safe:animate-pulse',
  'waiting-permission': 'bg-sunny motion-safe:animate-pulse',
  'timed-out': 'bg-danger',
  ready: 'bg-success',
  paused: 'bg-sunny',
  error: 'bg-danger',
}

/** Placement of each block per layout: stacked (phones), 2 columns (md), 3 columns (xl), sideways phones (short). */
const AREA = {
  intro: 'order-1 md:col-span-2 md:row-start-1 xl:col-span-1 short:col-span-1 short:col-start-2 short:row-start-1',
  camera:
    'order-2 md:col-start-1 md:row-span-4 md:row-start-2 xl:col-start-2 xl:row-span-3 xl:row-start-1 short:col-start-1 short:row-span-5 short:row-start-1',
  panel: 'order-3 md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1 short:col-start-2 short:row-start-2',
  action: 'order-4 md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-2 short:col-start-2 short:row-start-3',
  status: 'order-5 md:col-start-2 md:row-start-4 xl:col-start-3 xl:row-start-3 short:col-start-2 short:row-start-4',
  tips: 'order-6 md:col-start-2 md:row-start-5 short:col-start-2 short:row-start-5',
}

export default function ReadyScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.READY)
  const camera = useCamera(isLoaded)
  const { isLoading: isLoadingPhotos, missingIds } = usePhotoUrls(session?.shots ?? [])
  const [pickedCountdown, setPickedCountdown] = useState<PhotoboothCountdown | null>(null)
  const [isLeaving, setIsLeaving] = useNavigationLock()
  const [notice, setNotice] = useState<string | null>(null)
  const [storageStatus, setStorageStatus] = useState<PhotoStoreStatus | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const pending = consumeSessionNotice()
    if (pending) setNotice(SESSION_NOTICE_COPY[pending])
    void getPhotoStoreStatus().then(setStorageStatus)
  }, [isLoaded])

  // Shots already taken but gone from this device are re-taken in Capture.
  const missingKey = missingIds.join('|')
  useEffect(() => {
    if (isLoadingPhotos || !missingKey) return
    apply((current, now) => releaseMissingShots(current, missingKey.split('|'), now), { deleteDropped: false })
  }, [apply, isLoadingPhotos, missingKey])

  if (!isLoaded || !session) {
    return (
      <BrandPage>
        <main className="relative isolate flex min-h-full flex-col">
          <PastelBackdrop />
          <FlowHeader screen={SCREEN} />
          <Spinner className="flex-1" />
        </main>
      </BrandPage>
    )
  }

  const experience = getExperience(session.experienceId)
  const layout = getLayout(session.layoutId)
  const countdown = pickedCountdown ?? session.countdown
  const capturedCount = getCapturedCount(session)
  const isCameraReady = camera.state.status === 'ready'
  const memoryOnly = getMemoryOnlyPhotos(getReferencedPhotoIds(session))
  const storageNote = describeStorageRisk(storageStatus, memoryOnly)
  const slot = layout.slots[0]
  const remainingShots = experience.shotCount - capturedCount
  const shotPlan =
    countdown > 0
      ? `Bạn sẽ chụp ${remainingShots} ảnh liên tiếp: bấm một lần, máy đếm ngược ${countdown} giây trước mỗi ảnh.`
      : `Bạn sẽ chụp ${remainingShots} ảnh: bấm nút chụp cho từng ảnh.`

  function handleReady() {
    if (!isCameraReady || isLeaving) return
    if (!apply((current, now) => markReady(current, countdown, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.CAPTURE, { scroll: false })
  }

  return (
    <BrandPage>
      <main className="relative isolate min-h-full">
        <PastelBackdrop />
        <FlowHeader screen={SCREEN} />

        <div
          // The camera card is sized from the slot's shape and a per-layout height cap.
          style={{ '--camera-ratio': slot.width / slot.height } as CSSProperties}
          className={[
            SITE_CONTAINER,
            'flex flex-col gap-4 pt-4 pb-8 [--camera-max-h:52svh] sm:gap-5 sm:pt-5 sm:[--camera-max-h:58svh]',
            'md:grid md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] md:grid-rows-[auto_auto_auto_auto_1fr] md:gap-x-6 md:gap-y-4 md:[--camera-max-h:min(62svh,700px)]',
            'lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-x-8 lg:[--camera-max-h:min(66svh,700px)]',
            'xl:grid-cols-[minmax(230px,290px)_minmax(0,1fr)_minmax(320px,360px)] xl:grid-rows-[auto_auto_1fr] xl:gap-x-10',
            'short:grid short:grid-cols-[minmax(0,calc(var(--camera-max-h)*var(--camera-ratio)+1.5rem))_minmax(0,1fr)] short:grid-rows-[auto_auto_auto_auto_1fr] short:gap-x-6 short:gap-y-3 short:pt-2 short:[--camera-max-h:calc(100svh-5.5rem)]',
          ].join(' ')}
        >
          {/* Its own column from xl; below that its children take part in the page grid. */}
          <div className="contents xl:col-start-1 xl:row-span-3 xl:row-start-1 xl:flex xl:flex-col xl:gap-6">
            <section aria-labelledby="ready-title" className={`animate-rise text-center sm:text-left ${AREA.intro}`}>
              <BubbleHeading
                id="ready-title"
                className="mx-auto font-bubble text-[clamp(26px,8.2vw,40px)] leading-[1.12] font-extrabold tracking-[-0.01em] text-cocoa sm:mx-0 sm:text-[44px] lg:text-[40px] xl:text-[clamp(40px,3.4vw,56px)] short:text-[28px]"
                decorations={
                  <>
                    <HeartSticker className="absolute top-[-0.2em] right-[-0.45em] w-[0.55em] rotate-12" />
                    <Doodle className="absolute top-[-0.2em] left-[-0.55em] hidden w-[0.45em] -scale-x-100 xl:block" />
                  </>
                }
              >
                <span className="text-accent sm:block md:inline xl:block">Sẵn sàng</span>{' '}
                <span className="sm:block md:inline xl:block">chụp nào?</span>
              </BubbleHeading>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft sm:mt-3 sm:max-w-120 sm:text-[15px] short:hidden">
                Kiểm tra camera, chọn thời gian và chuẩn bị tạo những khung hình đáng nhớ nhé!
              </p>
            </section>
            <ReadyTips className={`animate-rise [animation-delay:160ms] ${AREA.tips}`} />
          </div>

          <section aria-label="Xem trước camera" className={`animate-rise [animation-delay:80ms] ${AREA.camera}`}>
            <div className="relative mx-auto w-[min(100%,calc(var(--camera-max-h)*var(--camera-ratio)+1.5rem))]">
              <HeartSticker className="absolute top-[58%] -left-4 z-10 hidden w-10 -rotate-12 animate-float sm:block" />
              <Doodle className="absolute -top-5 -right-4 z-10 hidden w-10 sm:block" />
              <StarSticker className="absolute -right-3 -bottom-3 z-10 w-8 animate-float [animation-delay:-1.5s] sm:w-10" />
              <div className="rounded-[32px] bg-white/90 p-3 shadow-[0_30px_60px_-30px_rgba(74,29,36,0.55)] ring-1 ring-blush-deep/70">
                <div className="flex aspect-(--camera-ratio) w-full">
                  <CameraViewport
                    camera={camera}
                    filter={toCssFilter(getLook(session.lookId))}
                    slot={slot}
                    reloadNote={describeReloadLoss(memoryOnly)}
                  >
                    {isCameraReady ? (
                      // Visual echo of the status below, which is the one announced to screen readers.
                      <p
                        aria-hidden="true"
                        className="absolute top-3 left-3 inline-flex animate-pop items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-semibold text-cocoa shadow-[0_6px_14px_-6px_rgba(0,0,0,0.4)]"
                      >
                        <span className="size-2.5 rounded-full bg-success" />
                        Camera đã sẵn sàng!
                      </p>
                    ) : null}
                  </CameraViewport>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Thiết lập buổi chụp" className={`flex animate-rise flex-col gap-4 [animation-delay:120ms] ${AREA.panel}`}>
            <PresetSummary
              experience={experience}
              layout={layout}
              frameId={session.frameId}
              lookId={session.lookId}
              capturedCount={capturedCount}
            />

            <fieldset className={`p-4 ${READY_CARD_CLASS_NAME}`}>
              <legend className="float-left mb-3 flex w-full items-center gap-2 font-bubble text-[17px] font-bold text-cocoa">
                <Clock aria-hidden="true" size={19} className="text-accent" />
                Hẹn giờ mỗi ảnh
              </legend>
              <div className="clear-both grid grid-cols-4 gap-2">
                {PHOTOBOOTH_COUNTDOWN_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === countdown}
                    onClick={() => setPickedCountdown(option)}
                    className={[
                      'h-12 rounded-2xl text-[15px] font-semibold tabular-nums transition-[background-color,color,box-shadow,translate] duration-200 ease-out-soft',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      option === countdown
                        ? 'bg-accent text-white shadow-[0_4px_0_#8e2a43]'
                        : 'bg-blush/70 text-cocoa hover:-translate-y-0.5 hover:bg-blush',
                    ].join(' ')}
                  >
                    {option === 0 ? 'Tắt' : `${option}s`}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          {/* Sticky on phones so the CTA never scrolls away; in flow, so it never covers content. */}
          <div
            className={`sticky bottom-0 z-20 -mx-4 border-t border-blush-deep/50 bg-petal/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none short:sticky short:mx-0 short:border-0 short:bg-petal/90 short:px-0 short:pt-2 short:backdrop-blur-md short:pb-[max(8px,env(safe-area-inset-bottom))] ${AREA.action}`}
          >
            <Button onClick={handleReady} disabled={!isCameraReady || isLeaving} variant="candy" size="lg" className="w-full">
              <Camera aria-hidden="true" size={19} />
              Sẵn sàng chụp
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
          </div>

          <div className={`flex flex-col gap-3 ${AREA.status}`}>
            <div className={`p-4 ${READY_CARD_CLASS_NAME}`}>
              <p className="flex items-center gap-2.5 font-bubble text-[16px] font-bold text-cocoa" aria-live="polite">
                <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ring-4 ring-white ${STATUS_DOT[camera.state.status]}`} />
                {STATUS_COPY[camera.state.status]}
              </p>
              <p className="mt-2 flex gap-2 text-[13px] leading-relaxed text-ink-soft">
                <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>Khung hình trên là đúng phần sẽ có trong ảnh. {shotPlan}</span>
              </p>
            </div>
            {actionError ? (
              <p role="alert" className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-medium text-danger ring-1 ring-danger/30">
                {actionError}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="rounded-2xl bg-white/80 px-4 py-3 text-[13px] leading-snug text-ink-soft ring-1 ring-blush-deep">
                {notice}
              </p>
            ) : null}
            {storageNote ? (
              <p role="status" className="rounded-2xl bg-white/80 px-4 py-3 text-[13px] leading-snug text-ink-soft ring-1 ring-blush-deep">
                {storageNote}
              </p>
            ) : null}
          </div>
        </div>

        <div className={`${SITE_CONTAINER} hidden pb-[max(32px,env(safe-area-inset-bottom))] md:block short:hidden`}>
          <ReadyPerks className="border-t border-blush-deep/50 pt-8" />
        </div>
      </main>
    </BrandPage>
  )
}
