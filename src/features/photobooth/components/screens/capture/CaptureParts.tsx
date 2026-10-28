import { Check, Sparkles } from 'lucide-react'
import { PANEL_CARD_CLASS_NAME } from '@/src/features/photobooth/components/shared/brand/surfaces'
import Image from '@/src/features/photobooth/components/shared/motion/SoftImage'
import type { CSSProperties } from 'react'
import type { PhotoboothLayout } from '@/src/features/photobooth/domain/layouts'
import { pad } from '@/src/features/photobooth/utils/format'

// Note: `.animate-pop` is reserved for the countdown number on this screen
// (e2e tests read the countdown through it), so nothing else here uses it.

type ShotState = 'done' | 'current' | 'pending'

function getShotState(index: number, activeShotIndex: number, hasPhoto: boolean): ShotState {
  if (index === activeShotIndex) return 'current'
  return hasPhoto ? 'done' : 'pending'
}

const SHOT_STATE_LABEL: Record<ShotState, string> = {
  done: 'đã chụp',
  current: 'đang chụp',
  pending: 'chưa chụp',
}

type ShotProgressProps = {
  layout: PhotoboothLayout
  /** Photo ids by shot index (the session's shots). */
  shots: Array<string | null>
  /** Object URLs by shot index; null hides a photo (e.g. the one being retaken). */
  urls: Array<string | null>
  activeShotIndex: number
  isRetake: boolean
  isComplete: boolean
  filter: string
}

/** "02 / 04", a progress bar and one thumbnail per shot: done, current or pending. */
export function ShotProgress({ layout, shots, urls, activeShotIndex, isRetake, isComplete, filter }: ShotProgressProps) {
  const total = shots.length
  const captured = shots.filter(Boolean).length
  // Once every shot is in, none is "current" any more.
  const currentIndex = isComplete && !isRetake ? -1 : activeShotIndex
  const shownNumber = currentIndex < 0 ? total : currentIndex + 1
  const subtitle = isRetake
    ? `Chụp lại ảnh ${activeShotIndex + 1} trong ${total}`
    : isComplete
      ? 'Đã chụp đủ ảnh, đang chuyển sang Xem lại'
      : `Đang chụp ảnh ${activeShotIndex + 1} trong ${total}`

  return (
    <div className={`p-4 sm:p-5 short:p-3 ${PANEL_CARD_CLASS_NAME}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent-deep uppercase">Tiến độ</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{subtitle}</p>
        </div>
        <p className="shrink-0 font-bubble text-[30px] leading-none font-extrabold text-cocoa tabular-nums sm:text-[36px]" aria-live="polite">
          {pad(shownNumber)}
          <span className="text-[0.6em] text-muted"> / {pad(total)}</span>
        </p>
      </div>

      <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-blush">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#de5f7b] to-accent-deep origin-left transition-transform duration-300 ease-out-soft"
          style={{ transform: `scaleX(${captured / total})` }}
        />
      </div>

      <ol
        aria-label="Tiến độ chụp"
        // Every shot in one row on phones; up to four per row in the side panel.
        style={{ '--shot-count': total, '--shot-columns': total > 4 ? 3 : total } as CSSProperties}
        className="mt-4 grid grid-cols-[repeat(var(--shot-count),minmax(0,1fr))] gap-2 md:grid-cols-[repeat(var(--shot-columns),minmax(0,1fr))] md:gap-2.5 short:mt-2 short:grid-cols-[repeat(var(--shot-count),minmax(0,1fr))]"
      >
        {shots.map((shot, index) => {
          const url = urls[index] ?? null
          const state = getShotState(index, currentIndex, Boolean(shot))
          const slot = layout.slots.find((candidate) => candidate.shotIndex === index) ?? layout.slots[0]

          return (
            <li
              key={index}
              aria-label={`Ảnh ${index + 1}: ${SHOT_STATE_LABEL[state]}`}
              aria-current={state === 'current' ? 'step' : undefined}
              className={[
                'relative mx-auto w-full max-w-20 overflow-hidden rounded-xl short:max-w-11 transition-[box-shadow,background-color] duration-200',
                state === 'current'
                  ? 'animate-select bg-blush shadow-[0_0_0_3px_var(--color-accent),0_10px_18px_-10px_rgba(176,58,85,0.8)]'
                  : state === 'done'
                    ? 'bg-paper-deep shadow-[0_6px_12px_-8px_rgba(74,29,36,0.5)] ring-2 ring-white'
                    : 'border-2 border-dashed border-blush-deep bg-white/70',
              ].join(' ')}
              style={{ aspectRatio: `${slot.width} / ${slot.height}` }}
            >
              {url && state !== 'current' ? (
                <span className="animate-select absolute inset-0">
                  <Image src={url} alt="" fill unoptimized sizes="80px" className="object-cover" style={{ filter }} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums ${
                    state === 'current' ? 'text-accent-deep' : 'text-muted'
                  }`}
                >
                  {pad(index + 1)}
                </span>
              )}
              {state === 'done' ? (
                <span aria-hidden="true" className="absolute right-1 bottom-1 grid animate-select size-4.5 place-items-center rounded-full bg-success text-white">
                  <Check size={11} strokeWidth={3.2} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

type PoseGuideProps = {
  /** One prompt per shot, from the experience config. */
  prompts: string[]
  shots: Array<string | null>
  activeShotIndex: number
}

/** Every pose of this experience in shot order, so people can see what comes next. */
export function PoseGuide({ prompts, shots, activeShotIndex }: PoseGuideProps) {
  return (
    <section aria-labelledby="pose-guide-title" className={`p-4 sm:p-5 ${PANEL_CARD_CLASS_NAME}`}>
      <h2 id="pose-guide-title" className="flex items-center gap-2 font-bubble text-[17px] font-bold text-cocoa">
        <Sparkles aria-hidden="true" size={18} className="text-accent" />
        Gợi ý tạo dáng
      </h2>
      {/* Chips that wrap on phones, a list in the side columns. Never scrolls, so Space stays the shutter. */}
      <ol className="mt-3 flex flex-wrap gap-2 md:flex-col md:gap-1.5">
        {prompts.map((prompt, index) => {
          const state = getShotState(index, activeShotIndex, Boolean(shots[index]))
          return (
            <li
              key={index}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-2xl px-2.5 py-1.5 text-[13px] leading-snug md:py-2 ${
                state === 'current' ? 'bg-blush font-semibold text-cocoa ring-1 ring-accent/40' : state === 'done' ? 'text-muted' : 'text-ink-soft'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${
                  state === 'current' ? 'bg-accent text-white' : state === 'done' ? 'bg-success/15 text-success' : 'bg-white text-muted ring-1 ring-blush-deep'
                }`}
              >
                {state === 'done' ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span className={state === 'done' ? 'line-through decoration-muted/50' : undefined}>{prompt}</span>
              <span className="sr-only"> ({SHOT_STATE_LABEL[state]})</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Big bubble number in the middle of the preview; re-keyed each second so it pops. */
export function CountdownOverlay({ value }: { value: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/10">
      <span
        key={value}
        className="animate-pop font-bubble text-[clamp(88px,36cqh,260px)] leading-none font-extrabold text-white [text-shadow:0_0.05em_0_var(--color-accent-deep),0_0.12em_0.3em_rgba(0,0,0,0.35)]"
      >
        {value}
      </span>
      <span className="rounded-full bg-white/90 px-4 py-1.5 text-[14px] font-semibold text-cocoa shadow-[0_6px_14px_-6px_rgba(0,0,0,0.4)]">
        Chuẩn bị chụp… giữ nguyên tư thế
      </span>
    </div>
  )
}
