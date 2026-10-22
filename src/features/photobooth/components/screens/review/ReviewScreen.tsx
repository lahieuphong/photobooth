'use client'

import { ArrowRight, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import MissingPhotosNotice from '@/src/features/photobooth/components/shared/feedback/MissingPhotosNotice'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
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
import ShotImage from './ShotImage'
import ShotLightbox from './ShotLightbox'

const pad = (value: number) => String(value).padStart(2, '0')

export default function ReviewScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.REVIEW)
  const draftId = session?.retake?.draftPhotoId ?? null
  const { urls, isLoading, missingIds, unreadableIds, retry } = usePhotoUrls(session ? [...session.shots, draftId] : [])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isLeaving, setIsLeaving] = useNavigationLock()

  if (!isLoaded || !session) {
    return (
      <ScreenShell>
        <ScreenHeader screen={PHOTOBOOTH_SCREENS.review} />
        <Spinner className="flex-1" />
      </ScreenShell>
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

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.review} />

      <div className="animate-rise mt-2 shrink-0">
        <h1 className="font-display text-[clamp(28px,5.6vw,46px)] font-light leading-tight tracking-[-0.01em] short:text-[26px]">
          {retake ? `Ảnh ${pad(retake.shotIndex + 1)}: giữ hay đổi?` : 'Chọn khoảnh khắc ưng ý.'}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          {retake
            ? retake.draftPhotoId
              ? 'So sánh hai ảnh rồi chọn ảnh bạn muốn giữ trong ảnh hoàn chỉnh.'
              : 'Bạn đang chụp lại ảnh này. Tiếp tục chụp hoặc hủy để giữ ảnh cũ.'
            : 'Chạm vào một ảnh để xem lớn hoặc chụp lại riêng ảnh đó.'}
        </p>
      </div>

      {hasMissing ? (
        <div className="mt-3">
          <MissingPhotosNotice
            missingCount={missingIds.length}
            unreadableCount={unreadableIds.length}
            onRecover={handleRecover}
            onRetry={retry}
            disabled={isLeaving}
          />
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className="mt-2 shrink-0 text-[13px] text-danger">
          {actionError}
        </p>
      ) : null}

      {retake ? (
        <section className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 sm:gap-5">
            {[
              { label: 'Ảnh hiện tại', url: shotUrls[retake.shotIndex] },
              { label: 'Ảnh mới', url: draftUrl },
            ].map((item) => (
              <figure key={item.label} className="flex min-h-0 flex-col gap-2">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-paper-deep">
                  {item.label === 'Ảnh mới' && !retake.draftPhotoId ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] text-muted">Chưa chụp</span>
                  ) : isLoading && !item.url ? (
                    <Spinner className="absolute inset-0" />
                  ) : (
                    <ShotImage url={item.url} filter={filter} fit="contain" sizes="45vw" />
                  )}
                </div>
                <figcaption className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {item.label}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="flex shrink-0 flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => apply((current, now) => cancelRetake(current, now))} disabled={isLeaving}>
              Giữ ảnh hiện tại
            </Button>
            {retake.draftPhotoId ? (
              <Button onClick={() => apply((current, now) => commitRetake(current, now))} disabled={isLeaving || !isDraftReady}>
                Dùng ảnh mới
              </Button>
            ) : (
              <Button onClick={() => go(PHOTOBOOTH_ROUTES.CAPTURE)} disabled={isLeaving}>
                <RotateCcw aria-hidden="true" size={16} />
                Tiếp tục chụp lại
              </Button>
            )}
          </div>
        </section>
      ) : (
        <>
          <ul
            className={[
              // `safe` keeps the first row reachable when the sheet is taller than the screen.
              'mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain [align-content:safe_center] sm:gap-4',
              session.shotCount === 6
                ? 'grid-cols-2 sm:grid-cols-3 short:grid-cols-6'
                : 'grid-cols-2 lg:grid-cols-4 short:grid-cols-4',
            ].join(' ')}
          >
            {shotUrls.map((url, index) => (
              <li key={index} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  className="group relative block w-full overflow-hidden rounded-[14px] bg-paper-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{ aspectRatio: slotAspect(index) }}
                  aria-label={`Xem ảnh ${index + 1}`}
                >
                  {isLoading && !url ? <Spinner className="absolute inset-0" /> : <ShotImage url={url} filter={filter} fit="cover" sizes="(max-width: 768px) 45vw, 260px" />}
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink">
                    {pad(index + 1)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[13px] text-ink-soft">
              {session.shotCount} ảnh · {layout.label}
            </p>
            <Button onClick={handleContinue} disabled={isLeaving || isLoading || hasMissing} size="lg">
              Vào Studio
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
          </div>
        </>
      )}

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
    </ScreenShell>
  )
}
