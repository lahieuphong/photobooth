'use client'

import { ArrowRight, Frame, LayoutGrid, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import { CameraSticker, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import MissingPhotosNotice from '@/src/features/photobooth/components/shared/feedback/MissingPhotosNotice'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { PHOTOBOOTH_FRAMES, formatFrameDate } from '@/src/features/photobooth/domain/frames'
import { PRINT_HEIGHT, PRINT_WIDTH, getCompatibleLayouts, getLayout } from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import {
  completeSession,
  releaseMissingShots,
  setFrame,
  setLayout,
  setLook,
} from '@/src/features/photobooth/domain/session'
import { useNavigationLock } from '@/src/features/photobooth/hooks/useNavigationLock'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import StudioOption from './StudioOption'

const SCREEN = PHOTOBOOTH_SCREENS.studio

type StudioTab = 'look' | 'frame' | 'layout'

const TABS: Array<{ id: StudioTab; label: string; icon: LucideIcon; title: string; subtitle: string }> = [
  { id: 'look', label: 'Look', icon: Sparkles, title: 'Màu sắc, phong cách ảnh', subtitle: 'Chọn bộ lọc để phù hợp với mood của bạn' },
  { id: 'frame', label: 'Khung', icon: Frame, title: 'Khung hình', subtitle: 'Chọn khung để tạo phong cách riêng' },
  { id: 'layout', label: 'Bố cục', icon: LayoutGrid, title: 'Bố cục', subtitle: 'Chọn cách sắp xếp ảnh trên tờ in' },
]

const PANEL_CARD_CLASS_NAME = 'rounded-[24px] bg-white/85 shadow-[0_14px_30px_-22px_rgba(74,29,36,0.45)] ring-1 ring-blush-deep/60'

export default function StudioScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.STUDIO)
  const { urls, isLoading, missingIds, unreadableIds, retry } = usePhotoUrls(session?.shots ?? [])
  const [tab, setTab] = useState<StudioTab>('look')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [isLeaving, setIsLeaving] = useNavigationLock()

  /** Tabs pattern: arrows move between tabs (wrapping), Home/End jump to the ends. */
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    let next: number
    if (event.key in steps) next = (index + steps[event.key] + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    else return
    event.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

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

  const layout = getLayout(session.layoutId)
  const compatibleLayouts = getCompatibleLayouts(session.shotCount)
  const dateLabel = formatFrameDate(session.createdAt)
  const composition = { layoutId: session.layoutId, frameId: session.frameId, lookId: session.lookId, photoUrls: urls, dateLabel }

  const problemIds = [...missingIds, ...unreadableIds]
  const hasMissing = problemIds.length > 0
  const isLocked = isLeaving || hasMissing

  function handleFinish() {
    if (isLocked || isLoading) return
    if (!apply((current, now) => completeSession(current, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.RESULT, { scroll: false })
  }

  function handleRecover() {
    if (isLeaving) return
    const next = apply((current, now) => releaseMissingShots(current, problemIds, now), { deleteDropped: false })
    if (!next) return
    setIsLeaving(true)
    router.push(getResumeRoute(next), { scroll: false })
  }

  // Shots were framed in the camera for the experience's own slot shape.
  const capturedLayout = getLayout(getExperience(session.experienceId).layoutId)
  const slotRatio = (option: typeof layout) => option.slots[0].width / option.slots[0].height
  const isRecropped = Math.abs(slotRatio(layout) - slotRatio(capturedLayout)) > 0.01

  const layoutNote = isRecropped
    ? `Ảnh được căn khung cho ${capturedLayout.label}; bố cục này cắt lại ảnh theo tỉ lệ ô mới.`
    : layout.repeatsShots
    ? 'Mỗi ảnh xuất hiện hai lần — nếu in ra, cắt đôi để có hai dải giống nhau.'
    : compatibleLayouts.length === 1
      ? `Bộ ${session.shotCount} ảnh dùng ${layout.label}.`
      : layout.description

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0]
  const filter = toCssFilter(getLook(session.lookId))
  const optionDescription =
    tab === 'look'
      ? PHOTOBOOTH_LOOKS.find((look) => look.id === session.lookId)?.description
      : tab === 'frame'
        ? PHOTOBOOTH_FRAMES.find((frame) => frame.id === session.frameId)?.description
        : layoutNote

  return (
    <BrandPage>
      <main className="relative isolate min-h-full">
        <PastelBackdrop />
        <FlowHeader screen={SCREEN} />

        <div
          // The print is sized from its own shape and a per-layout height cap.
          style={{ '--print-ratio': PRINT_WIDTH / PRINT_HEIGHT } as CSSProperties}
          className={[
            SITE_CONTAINER,
            'flex flex-col gap-5 pt-4 pb-8 [--print-max-h:44svh] sm:pt-5 sm:[--print-max-h:52svh]',
            'md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:items-start md:gap-x-8 md:[--print-max-h:min(calc(100svh-17rem),760px)]',
            'lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-x-12 lg:[--print-max-h:min(calc(100svh-19rem),800px)]',
            'short:grid short:grid-cols-[minmax(0,calc(var(--print-max-h)*var(--print-ratio)+2rem))_minmax(0,1fr)] short:gap-x-6 short:pt-2 short:[--print-max-h:calc(100svh-6rem)]',
          ].join(' ')}
        >
          <section aria-label="Xem trước ảnh hoàn chỉnh" className="flex animate-rise flex-col items-center gap-5 md:sticky md:top-4">
            <div className="relative w-[min(100%,calc(var(--print-max-h)*var(--print-ratio)+2rem))] md:-rotate-1">
              {/* Washi tape and stickers: decoration around the print, never on it. */}
              <span
                aria-hidden="true"
                className="absolute -top-3 left-1/2 z-10 h-7 w-28 -translate-x-1/2 -rotate-3 rounded-[3px] bg-[repeating-linear-gradient(45deg,rgb(245_191_204/0.9)_0_6px,rgb(253_230_235/0.9)_6px_12px)] shadow-[0_4px_8px_-4px_rgba(74,29,36,0.3)]"
              />
              <HeartSticker className="absolute top-[18%] -left-4 z-10 hidden w-10 -rotate-12 animate-float sm:block" />
              <StarSticker className="absolute top-[8%] -right-4 z-10 hidden w-9 animate-float [animation-delay:-1.4s] sm:block" />
              <CameraSticker className="absolute -right-6 -bottom-6 z-10 hidden w-24 rotate-12 md:block" />
              <div className="rounded-[20px] bg-white p-4 shadow-[0_34px_70px_-34px_rgba(74,29,36,0.6)] ring-1 ring-blush-deep/50">
                <PhotoComposition {...composition} className="rounded-[4px]" imageSizes="(max-width: 768px) 70vw, 480px" />
              </div>
            </div>

            {/* The untouched originals, shown with the current look. */}
            <div className="hidden w-full max-w-120 items-center gap-3 md:flex short:hidden">
              <span className="shrink-0 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Ảnh gốc</span>
              <ul className="flex min-w-0 flex-1 gap-2">
                {urls.map((url, index) => (
                  <li key={index} className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-xl bg-paper-deep ring-2 ring-white">
                    {url ? (
                      <Image src={url} alt={`Ảnh gốc ${index + 1}`} fill unoptimized sizes="64px" className="object-cover" style={{ filter }} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="studio-title" className="flex min-w-0 animate-rise flex-col gap-4 [animation-delay:100ms]">
            <div className="text-center sm:text-left">
              <BubbleHeading
                id="studio-title"
                className="mx-auto font-bubble text-[clamp(30px,9vw,44px)] leading-[1.1] font-extrabold text-cocoa sm:mx-0 lg:text-[48px] short:text-[28px]"
                decorations={<HeartSticker className="absolute top-[-0.15em] right-[-0.55em] w-[0.5em] rotate-12" />}
              >
                <span className="text-accent">Studio</span>
              </BubbleHeading>
              <p className="mt-2 flex items-start justify-center gap-2 text-[14px] leading-relaxed text-ink-soft sm:justify-start short:hidden">
                <ShieldCheck aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-accent" />
                Mọi thay đổi chỉ áp dụng lên ảnh hoàn chỉnh — ảnh gốc luôn được giữ nguyên.
              </p>
            </div>

            {hasMissing ? (
              <MissingPhotosNotice
                missingCount={missingIds.length}
                unreadableCount={unreadableIds.length}
                onRecover={handleRecover}
                onRetry={retry}
                disabled={isLeaving}
              />
            ) : null}

            <div role="tablist" aria-label="Tùy chỉnh" className="grid grid-cols-3 gap-1.5 rounded-full bg-white/70 p-1.5 ring-1 ring-blush-deep/70">
              {TABS.map((item, index) => {
                const isActive = tab === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    ref={(element) => {
                      tabRefs.current[index] = element
                    }}
                    id={`studio-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="studio-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={[
                      'inline-flex h-12 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-[background-color,color,box-shadow] duration-200 sm:text-[15px]',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      isActive
                        ? 'bg-white text-accent-deep shadow-[0_6px_14px_-8px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep'
                        : 'text-ink-soft hover:bg-white/60 hover:text-cocoa',
                    ].join(' ')}
                  >
                    <Icon aria-hidden="true" size={17} />
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Only the active tab's options are rendered; the choices themselves live in the session. */}
            <div
              key={tab}
              id="studio-tabpanel"
              role="tabpanel"
              aria-labelledby={`studio-tab-${tab}`}
              className={`animate-rise p-4 sm:p-5 ${PANEL_CARD_CLASS_NAME}`}
            >
              <h2 className="flex items-center gap-2 font-bubble text-[17px] font-bold text-cocoa">
                <HeartSticker className="w-5" />
                {activeTab.title}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">{activeTab.subtitle}</p>

              <div
                role="radiogroup"
                aria-label={activeTab.label}
                className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(60px,1fr))] sm:gap-2.5"
              >
                {tab === 'look'
                  ? PHOTOBOOTH_LOOKS.map((look) => (
                      <StudioOption
                        key={look.id}
                        label={look.label}
                        isSelected={session.lookId === look.id}
                        disabled={isLocked}
                        onClick={() => apply((current, now) => setLook(current, look.id, now))}
                      >
                        <span className="relative block aspect-square w-full">
                          {urls[0] ? (
                            <Image src={urls[0]} alt="" fill unoptimized sizes="80px" className="object-cover" style={{ filter: toCssFilter(look) }} />
                          ) : null}
                        </span>
                      </StudioOption>
                    ))
                  : null}

                {tab === 'frame'
                  ? PHOTOBOOTH_FRAMES.map((frame) => (
                      <StudioOption
                        key={frame.id}
                        label={frame.label}
                        isSelected={session.frameId === frame.id}
                        disabled={isLocked}
                        onClick={() => apply((current, now) => setFrame(current, frame.id, now))}
                      >
                        <PhotoComposition {...composition} frameId={frame.id} imageSizes="80px" />
                      </StudioOption>
                    ))
                  : null}

                {tab === 'layout'
                  ? compatibleLayouts.map((option) => (
                      <StudioOption
                        key={option.id}
                        label={option.label}
                        caption={`${option.slots.length} ô`}
                        isSelected={session.layoutId === option.id}
                        disabled={isLocked}
                        onClick={() => apply((current, now) => setLayout(current, option.id, now))}
                      >
                        <PhotoComposition {...composition} layoutId={option.id} imageSizes="80px" />
                      </StudioOption>
                    ))
                  : null}
              </div>

              <p className="mt-4 min-h-[2.5em] rounded-2xl bg-petal px-3 py-2 text-[13px] leading-snug text-cocoa/80" aria-live="polite">
                {optionDescription}
              </p>
            </div>

            {actionError ? (
              <p role="alert" className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-medium text-danger ring-1 ring-danger/30">
                {actionError}
              </p>
            ) : null}

            {/* Sticky on phones so finishing is always one tap away; in flow, so it never covers options. */}
            <div className="sticky bottom-0 z-20 -mx-4 border-t border-blush-deep/50 bg-petal/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none short:sticky short:mx-0 short:bg-petal/90 short:px-0 short:pt-2 short:pb-[max(8px,env(safe-area-inset-bottom))] short:backdrop-blur-md">
              <Button onClick={handleFinish} disabled={isLocked || isLoading} variant="candy" size="lg" className="w-full">
                Hoàn tất
                <ArrowRight aria-hidden="true" size={18} />
              </Button>
            </div>
          </section>
        </div>
      </main>
    </BrandPage>
  )
}
