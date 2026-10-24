'use client'

import { ArrowRight, Heart, Images, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import PerkStrip, { type Perk } from '@/src/features/photobooth/components/shared/brand/PerkStrip'
import { Doodle, HeartSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import TipsCard from '@/src/features/photobooth/components/shared/brand/TipsCard'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import MissingPhotosNotice from '@/src/features/photobooth/components/shared/feedback/MissingPhotosNotice'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import {
  cancelRetake,
  commitRetake,
  enterStudio,
  releaseMissingShots,
  startRetake,
} from '@/src/features/photobooth/domain/session'
import { useNavigationLock } from '@/src/features/photobooth/hooks/useNavigationLock'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import ShotCard from './ShotCard'
import ShotImage from './ShotImage'
import ShotLightbox from './ShotLightbox'

const pad = (value: number) => String(value).padStart(2, '0')

const SCREEN = PHOTOBOOTH_SCREENS.review

// Every shot fills its slot in the print: Review is for looking and retaking, not for picking.
const TIPS = [
  'Chạm vào ảnh để xem lớn và so sánh',
  'Chưa ưng ảnh nào? Bấm “Chụp lại” dưới ảnh đó',
  'Ảnh mới chỉ thay ảnh cũ khi bạn đồng ý',
  'Khung và tông màu chỉnh tiếp trong Studio',
]

const PERKS: Perk[] = [
  { title: 'Dễ xem & so sánh', text: 'Chạm vào ảnh để xem lớn hơn.', icon: <Images aria-hidden="true" size={20} /> },
  { title: 'Chụp lại linh hoạt', text: 'Chỉ chụp lại ảnh bạn chưa ưng ý.', icon: <RotateCcw aria-hidden="true" size={20} /> },
  { title: 'Giữ khoảnh khắc đẹp', text: 'Thêm khung và màu trong Studio.', icon: <Heart aria-hidden="true" size={20} /> },
  { title: 'Riêng tư', text: 'Ảnh chỉ nằm trong trình duyệt trên máy của bạn.', icon: <ShieldCheck aria-hidden="true" size={20} /> },
]

/** Sticky bar on phones; a floating card that stays reachable under a tall grid from `md`. */
const ACTION_BAR_CLASS_NAME =
  'sticky bottom-0 z-20 -mx-4 flex flex-col gap-3 border-t border-blush-deep/50 bg-petal/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md ' +
  'sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 ' +
  'md:bottom-4 md:mx-0 md:rounded-[24px] md:border-0 md:bg-white/85 md:px-5 md:py-4 md:shadow-[0_18px_36px_-22px_rgba(74,29,36,0.55)] md:ring-1 md:ring-blush-deep/60 ' +
  'short:bottom-0 short:py-2 short:pb-[max(8px,env(safe-area-inset-bottom))]'

export default function ReviewScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.REVIEW)
  const draftId = session?.retake?.draftPhotoId ?? null
  const { urls, isLoading, missingIds, unreadableIds, retry } = usePhotoUrls(session ? [...session.shots, draftId] : [])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isLeaving, setIsLeaving] = useNavigationLock()

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
  const filter = toCssFilter(getLook(session.lookId))
  const shotUrls = urls.slice(0, session.shotCount)
  const draftUrl = urls[session.shotCount] ?? null
  const retake = session.retake

  function slotAspect(shotIndex: number) {
    const slot = layout.slots.find((item) => item.shotIndex === shotIndex) ?? layout.slots[0]
    return `${slot.width} / ${slot.height}`
  }

  const problemIds = [...missingIds, ...unreadableIds]
  const hasMissing = problemIds.length > 0
  const isDraftReady = Boolean(retake?.draftPhotoId && draftUrl)

  function go(route: PhotoboothRoute) {
    setIsLeaving(true)
    router.push(route, { scroll: false })
  }

  function handleRetake(shotIndex: number) {
    if (isLeaving || !apply((current, now) => startRetake(current, shotIndex, now))) return
    go(PHOTOBOOTH_ROUTES.CAPTURE)
  }

  function handleContinue() {
    if (isLeaving || isLoading || hasMissing) return
    if (apply((current, now) => enterStudio(current, now))) go(PHOTOBOOTH_ROUTES.STUDIO)
  }

  function handleRecover() {
    if (isLeaving) return
    const next = apply((current, now) => releaseMissingShots(current, problemIds, now), { deleteDropped: false })
    if (!next) return
    setOpenIndex(null)
    const route = getResumeRoute(next)
    if (route !== PHOTOBOOTH_ROUTES.REVIEW) go(route)
  }

  const experience = getExperience(session.experienceId)
  const compareSlot = retake ? (layout.slots.find((item) => item.shotIndex === retake.shotIndex) ?? layout.slots[0]) : null

  return (
    <BrandPage>
      <main className="relative isolate min-h-full">
        <PastelBackdrop />
        <FlowHeader screen={SCREEN} />

        <div
          className={`${SITE_CONTAINER} flex flex-col gap-5 pt-3 pb-8 sm:pt-5 xl:grid xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:items-start xl:gap-x-10 short:gap-3 short:pt-2`}
        >
          {/* Its own column from xl; below that the intro leads and the tips follow the photos. */}
          <div className="contents xl:sticky xl:top-6 xl:col-start-1 xl:row-start-1 xl:flex xl:flex-col xl:gap-6">
            <section aria-labelledby="review-title" className="order-1 animate-rise text-center sm:text-left">
              <span className="inline-block rounded-full bg-butter px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-accent-deep uppercase ring-1 ring-cream short:hidden">
                {experience.title} · {session.shotCount} ảnh
              </span>
              <BubbleHeading
                id="review-title"
                className="mx-auto mt-3 font-bubble text-[clamp(28px,8.6vw,44px)] leading-[1.12] font-extrabold tracking-[-0.01em] text-cocoa sm:mx-0 xl:text-[clamp(44px,3.6vw,58px)] short:mt-0 short:text-[28px]"
                decorations={
                  <>
                    <HeartSticker className="absolute top-[-0.15em] right-[-0.45em] w-[0.55em] rotate-12" />
                    <Doodle className="absolute top-[-0.25em] left-[-0.55em] hidden w-[0.45em] -scale-x-100 xl:block" />
                  </>
                }
              >
                {retake ? (
                  <>
                    Ảnh {pad(retake.shotIndex + 1)}: <span className="text-accent">giữ hay đổi?</span>
                  </>
                ) : (
                  <>
                    <span className="text-accent xl:block">Chọn ảnh</span> <span className="xl:block">ưng ý</span>
                  </>
                )}
              </BubbleHeading>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft sm:mt-3 sm:max-w-120 sm:text-[15px] short:mt-1 short:text-[13px]">
                {retake
                  ? retake.draftPhotoId
                    ? 'So sánh hai ảnh rồi chọn ảnh bạn muốn giữ trong ảnh hoàn chỉnh.'
                    : 'Bạn đang chụp lại ảnh này. Tiếp tục chụp hoặc hủy để giữ ảnh cũ.'
                  : 'Chạm vào một ảnh để xem lớn hơn hoặc chụp lại ảnh đó nhé!'}
              </p>
            </section>
            <TipsCard id="review-tips-title" tips={TIPS} className="order-3 animate-rise [animation-delay:200ms] short:hidden" />
          </div>

          <div className="order-2 flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-1">
            {hasMissing ? (
              <MissingPhotosNotice
                missingCount={missingIds.length}
                unreadableCount={unreadableIds.length}
                onRecover={handleRecover}
                onRetry={retry}
                disabled={isLeaving}
              />
            ) : null}
            {actionError ? (
              <p role="alert" className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-medium text-danger ring-1 ring-danger/30">
                {actionError}
              </p>
            ) : null}

            {retake && compareSlot ? (
              <>
                <section
                  aria-label="So sánh ảnh"
                  style={{ '--compare-ratio': compareSlot.width / compareSlot.height } as CSSProperties}
                  className="grid grid-cols-2 gap-3 sm:gap-6"
                >
                  {[
                    { label: 'Ảnh hiện tại', url: shotUrls[retake.shotIndex], isDraft: false },
                    { label: 'Ảnh mới', url: draftUrl, isDraft: true },
                  ].map((item) => (
                    <figure
                      key={item.label}
                      className={`mx-auto flex w-[min(100%,calc(min(54svh,640px)*var(--compare-ratio)+1.25rem))] animate-rise flex-col gap-2 rounded-[22px] p-2.5 ${
                        item.isDraft
                          ? 'bg-linear-to-b from-blush to-white shadow-[0_0_0_3px_var(--color-accent),0_20px_36px_-22px_rgba(176,58,85,0.7)]'
                          : 'bg-white shadow-[0_18px_34px_-24px_rgba(74,29,36,0.55)] ring-1 ring-blush-deep/60'
                      }`}
                    >
                      <div className="relative aspect-(--compare-ratio) overflow-hidden rounded-[16px] bg-paper-deep">
                        {item.isDraft && !retake.draftPhotoId ? (
                          <span className="absolute inset-0 flex items-center justify-center text-[13px] text-muted">Chưa chụp</span>
                        ) : isLoading && !item.url ? (
                          <Spinner className="absolute inset-0" />
                        ) : (
                          <ShotImage url={item.url} filter={filter} fit="cover" sizes="45vw" />
                        )}
                      </div>
                      <figcaption
                        className={`flex items-center justify-center gap-1.5 py-1 text-center text-[12px] font-bold tracking-[0.14em] uppercase ${
                          item.isDraft ? 'text-accent-deep' : 'text-muted'
                        }`}
                      >
                        {item.isDraft ? <Sparkles aria-hidden="true" size={14} /> : null}
                        {item.label}
                      </figcaption>
                    </figure>
                  ))}
                </section>

                <div className={ACTION_BAR_CLASS_NAME}>
                  <p className="text-center text-[13px] text-ink-soft sm:text-left">Ảnh {pad(retake.shotIndex + 1)} · {layout.label}</p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="bubble" size="lg" onClick={() => apply((current, now) => cancelRetake(current, now))} disabled={isLeaving}>
                      Giữ ảnh hiện tại
                    </Button>
                    {retake.draftPhotoId ? (
                      <Button
                        variant="candy"
                        size="lg"
                        onClick={() => apply((current, now) => commitRetake(current, now))}
                        disabled={isLeaving || !isDraftReady}
                      >
                        Dùng ảnh mới
                      </Button>
                    ) : (
                      <Button variant="candy" size="lg" onClick={() => go(PHOTOBOOTH_ROUTES.CAPTURE)} disabled={isLeaving}>
                        <RotateCcw aria-hidden="true" size={16} />
                        Tiếp tục chụp lại
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <ul
                  aria-label="Ảnh đã chụp"
                  className={`grid gap-3 sm:gap-4 lg:gap-5 ${
                    session.shotCount === 6 ? 'grid-cols-2 sm:grid-cols-3 short:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'
                  }`}
                >
                  {shotUrls.map((url, index) => (
                    <li key={index} className="min-w-0">
                      <ShotCard
                        index={index}
                        url={url}
                        isLoading={isLoading}
                        filter={filter}
                        aspectRatio={slotAspect(index)}
                        disabled={isLeaving}
                        onOpen={() => setOpenIndex(index)}
                        onRetake={() => handleRetake(index)}
                        style={{ animationDelay: `${80 + index * 50}ms` }}
                      />
                    </li>
                  ))}
                </ul>

                <div className={ACTION_BAR_CLASS_NAME}>
                  <div className="hidden min-w-0 sm:block">
                    <p className="font-bubble text-[17px] font-bold text-cocoa">
                      {session.shotCount} ảnh · {layout.label}
                    </p>
                    <p className="text-[13px] text-ink-soft">Ưng hết rồi? Vào Studio để chọn khung và tông màu.</p>
                  </div>
                  <Button
                    onClick={handleContinue}
                    disabled={isLeaving || isLoading || hasMissing}
                    variant="candy"
                    size="lg"
                    className="w-full sm:w-auto sm:min-w-52"
                  >
                    Vào Studio
                    <ArrowRight aria-hidden="true" size={18} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`${SITE_CONTAINER} hidden pb-[max(32px,env(safe-area-inset-bottom))] md:block short:hidden`}>
          <PerkStrip perks={PERKS} className="border-t border-blush-deep/50 pt-8" />
        </div>
      </main>

      {openIndex !== null ? (
        <ShotLightbox
          index={openIndex}
          total={session.shotCount}
          url={shotUrls[openIndex]}
          filter={filter}
          onNavigate={setOpenIndex}
          onRetake={() => handleRetake(openIndex)}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </BrandPage>
  )
}
