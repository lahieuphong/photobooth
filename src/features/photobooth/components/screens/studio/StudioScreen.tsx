'use client'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import FittedComposition from '@/src/features/photobooth/components/shared/composition/FittedComposition'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { PHOTOBOOTH_FRAMES, formatFrameDate } from '@/src/features/photobooth/domain/frames'
import { getCompatibleLayouts, getLayout } from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, toCssFilter } from '@/src/features/photobooth/domain/looks'
import { completeSession, setFrame, setLayout, setLook } from '@/src/features/photobooth/domain/session'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'

type StudioTab = 'look' | 'frame' | 'layout'

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'look', label: 'Look' },
  { id: 'frame', label: 'Khung' },
  { id: 'layout', label: 'Bố cục' },
]

function OptionButton({
  isSelected,
  onClick,
  label,
  caption,
  children,
}: {
  isSelected: boolean
  onClick: () => void
  label: string
  caption?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onClick}
      className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center focus-visible:outline-none"
    >
      <span
        className={[
          'relative block w-full overflow-hidden rounded-[12px] border-2 transition-colors duration-150',
          isSelected ? 'border-accent' : 'border-transparent group-hover:border-line',
          'group-focus-visible:border-ink',
        ].join(' ')}
      >
        {children}
      </span>
      <span className={`text-[12px] font-semibold ${isSelected ? 'text-ink' : 'text-ink-soft'}`}>{label}</span>
      {caption ? <span className="-mt-1 text-[10px] leading-tight text-muted">{caption}</span> : null}
    </button>
  )
}

export default function StudioScreen() {
  const router = useRouter()
  const { session, isLoaded, update } = usePhotoboothSession(PHOTOBOOTH_ROUTES.STUDIO)
  const { urls } = usePhotoUrls(session?.shots ?? [])
  const [tab, setTab] = useState<StudioTab>('look')

  if (!isLoaded || !session) {
    return (
      <ScreenShell>
        <ScreenHeader screen={PHOTOBOOTH_SCREENS.studio} />
        <Spinner className="flex-1" />
      </ScreenShell>
    )
  }

  const layout = getLayout(session.layoutId)
  const compatibleLayouts = getCompatibleLayouts(session.shotCount)
  const dateLabel = formatFrameDate(session.createdAt)
  const composition = { layoutId: session.layoutId, frameId: session.frameId, lookId: session.lookId, photoUrls: urls, dateLabel }

  function handleFinish() {
    update((current, now) => completeSession(current, now))
    router.push(PHOTOBOOTH_ROUTES.RESULT, { scroll: false })
  }

  // Shots were framed in the camera for the experience's own slot shape.
  const capturedLayout = getLayout(getExperience(session.experienceId).layoutId)
  const slotRatio = (option: typeof layout) => option.slots[0].width / option.slots[0].height
  const isRecropped = Math.abs(slotRatio(layout) - slotRatio(capturedLayout)) > 0.01

  const layoutNote = isRecropped
    ? `Ảnh được căn khung cho ${capturedLayout.label}; bố cục này cắt lại ảnh theo tỉ lệ ô mới.`
    : layout.repeatsShots
    ? 'Mỗi ảnh được in hai lần — cắt đôi để có hai dải giống nhau.'
    : compatibleLayouts.length === 1
      ? `Bộ ${session.shotCount} ảnh dùng ${layout.label}.`
      : layout.description

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.studio} />

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-10">
        <FittedComposition {...composition} imageSizes="(max-width: 768px) 70vw, 420px" />

        <aside className="flex shrink-0 flex-col gap-3 md:w-[340px] md:[justify-content:safe_center] short:min-h-0 short:overflow-y-auto">
          <div className="hidden md:block short:hidden">
            <h1 className="font-display text-[40px] font-light leading-tight">Studio</h1>
            <p className="mt-1 text-[14px] text-ink-soft">Mọi thay đổi chỉ áp dụng lên bản in — ảnh gốc luôn được giữ nguyên.</p>
          </div>

          <div role="tablist" aria-label="Tùy chỉnh" className="grid grid-cols-3 gap-1 rounded-full bg-paper-deep p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={[
                  'h-10 rounded-full text-[14px] font-semibold transition-colors duration-150',
                  tab === item.id ? 'bg-white text-ink shadow-[0_2px_8px_rgba(26,23,20,0.08)]' : 'text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="radiogroup" aria-label={TABS.find((item) => item.id === tab)?.label} className="-mx-1 flex shrink-0 gap-3 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible short:flex-nowrap short:overflow-x-auto">
            {tab === 'look'
              ? PHOTOBOOTH_LOOKS.map((look) => (
                  <OptionButton
                    key={look.id}
                    label={look.label}
                    isSelected={session.lookId === look.id}
                    onClick={() => update((current, now) => setLook(current, look.id, now))}
                  >
                    <span className="relative block aspect-square w-full bg-paper-deep">
                      {urls[0] ? (
                        <Image src={urls[0]} alt="" fill unoptimized sizes="76px" className="object-cover" style={{ filter: toCssFilter(look) }} />
                      ) : null}
                    </span>
                  </OptionButton>
                ))
              : null}

            {tab === 'frame'
              ? PHOTOBOOTH_FRAMES.map((frame) => (
                  <OptionButton
                    key={frame.id}
                    label={frame.label}
                    isSelected={session.frameId === frame.id}
                    onClick={() => update((current, now) => setFrame(current, frame.id, now))}
                  >
                    <PhotoComposition {...composition} frameId={frame.id} imageSizes="76px" />
                  </OptionButton>
                ))
              : null}

            {tab === 'layout'
              ? compatibleLayouts.map((option) => (
                  <OptionButton
                    key={option.id}
                    label={option.label}
                    caption={`${option.slots.length} ô`}
                    isSelected={session.layoutId === option.id}
                    onClick={() => update((current, now) => setLayout(current, option.id, now))}
                  >
                    <PhotoComposition {...composition} layoutId={option.id} imageSizes="76px" />
                  </OptionButton>
                ))
              : null}
          </div>

          <p className="min-h-[2.5em] text-[13px] leading-snug text-ink-soft" aria-live="polite">
            {tab === 'look'
              ? PHOTOBOOTH_LOOKS.find((look) => look.id === session.lookId)?.description
              : tab === 'frame'
                ? PHOTOBOOTH_FRAMES.find((frame) => frame.id === session.frameId)?.description
                : layoutNote}
          </p>

          <Button onClick={handleFinish} size="lg" className="w-full">
            Hoàn tất
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </aside>
      </div>
    </ScreenShell>
  )
}
