import type { CSSProperties } from 'react'
import { PRINT_HEIGHT, PRINT_WIDTH, getLayout, type PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'

type SkeletonBlockProps = { className?: string; style?: CSSProperties }

/** Presentational only: never introduce a fake delay or block interaction. */
export function SkeletonBlock({ className = '', style }: SkeletonBlockProps) {
  return <span aria-hidden="true" style={style} className={`skeleton-block block rounded-xl ${className}`} />
}

/** Preserves its parent's real image aspect ratio and layout while an object URL loads. */
export function PhotoSkeleton({ className = '' }: { className?: string }) {
  return <SkeletonBlock className={`absolute inset-0 !rounded-[inherit] ${className}`} />
}

/** Only pending slots are covered; photos already read stay visible during a retry. */
export function PrintSkeleton({ layoutId, photoUrls }: { layoutId: PhotoboothLayoutId; photoUrls: ReadonlyArray<string | null> }) {
  const layout = getLayout(layoutId)
  const pendingSlots = layout.slots.filter((slot) => !photoUrls[slot.shotIndex])
  if (pendingSlots.length === 0) return null
  return (
    <div role="status" aria-label="Đang chuẩn bị ảnh" data-skeleton="print" className="absolute inset-0 z-10 overflow-hidden rounded-[4px]">
      {pendingSlots.map((slot, index) => (
        <span
          key={`${slot.shotIndex}-${index}`}
          aria-hidden="true"
          data-skeleton-slot={slot.shotIndex}
          className="skeleton-block absolute block rounded-[3px]"
          style={{
            left: `${(slot.x / PRINT_WIDTH) * 100}%`,
            top: `${(slot.y / PRINT_HEIGHT) * 100}%`,
            width: `${(slot.width / PRINT_WIDTH) * 100}%`,
            height: `${(slot.height / PRINT_HEIGHT) * 100}%`,
          }}
        />
      ))}
    </div>
  )
}

/** Camera scaffold is shown only during actual initialization, never for permission/errors. */
export function CameraSkeleton() {
  return (
    <div role="status" aria-label="Đang mở camera…" data-skeleton="camera" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#241e21] p-6">
      <SkeletonBlock className="skeleton-block-dark size-16 !rounded-full sm:size-20" />
      <SkeletonBlock className="skeleton-block-dark h-3 w-40 max-w-[75%] !rounded-full" />
      <SkeletonBlock className="skeleton-block-dark h-2.5 w-28 max-w-[65%] !rounded-full" />
      <span className="sr-only">Đang mở camera…</span>
    </div>
  )
}

type ScreenName = 'ready' | 'capture' | 'review' | 'studio' | 'result'

/** The initial session-hydration scaffold; the real header remains visible and functional. */
export default function ScreenSkeleton({ screen }: { screen: ScreenName }) {
  const isPhotoGrid = screen === 'review'
  const isCamera = screen === 'ready' || screen === 'capture'
  return (
    <section role="status" aria-label="Đang tải trải nghiệm" data-skeleton="screen" className={`${SITE_CONTAINER} flex w-full flex-1 flex-col gap-5 pt-5 pb-8 md:pt-8`}>
      <span className="sr-only">Đang chuẩn bị trải nghiệm Photobooth…</span>
      <div className="grid min-w-0 gap-7 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:gap-10">
        <div className="flex min-w-0 flex-col items-center gap-5 md:items-stretch">
          {isPhotoGrid ? (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rounded-[20px] bg-white p-2.5 shadow-[0_12px_28px_-22px_rgba(74,29,36,0.4)]">
                  <SkeletonBlock className="aspect-[3/4] w-full !rounded-[14px]" />
                  <SkeletonBlock className="mt-3 h-9 w-full !rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className={`w-full max-w-[min(80vw,370px)] ${isCamera ? 'md:max-w-[430px]' : 'md:max-w-[520px]'}`}>
              <div className="relative overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_24px_50px_-32px_rgba(74,29,36,0.5)]">
                <SkeletonBlock className={`w-full ${isCamera ? 'aspect-[3/4]' : 'aspect-[1200/1566]'} !rounded-[16px]`} />
              </div>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 rounded-[26px] bg-white/75 p-5 ring-1 ring-blush-deep/50">
          <SkeletonBlock className="h-3 w-24 !rounded-full" />
          <SkeletonBlock className="h-9 w-3/4 !rounded-full" />
          <SkeletonBlock className="h-3 w-full !rounded-full" />
          <SkeletonBlock className="h-3 w-4/5 !rounded-full" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="aspect-square w-full !rounded-2xl" />)}
          </div>
          <SkeletonBlock className="mt-4 h-12 w-full !rounded-full" />
        </div>
      </div>
    </section>
  )
}
