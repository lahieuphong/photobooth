import { Check, Images, LayoutGrid } from 'lucide-react'
import type { KeyboardEvent, Ref } from 'react'
import { PASTEL_TILE_TONES } from '@/src/features/photobooth/components/shared/brand/palette'
import { HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import type { PhotoboothExperience } from '@/src/features/photobooth/config/experiences'
import { getLayout } from '@/src/features/photobooth/domain/layouts'

type ExperienceCardProps = {
  experience: PhotoboothExperience
  index: number
  isSelected: boolean
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  buttonRef: Ref<HTMLButtonElement>
}

/** One small sticker per tile corner, varied by card; decorative and kept clear of the print. */
const TILE_STICKERS = [
  <StarSticker key="star" className="absolute bottom-3 left-3 w-5" />,
  <StarSticker key="star" className="absolute top-3 left-3 w-4 rotate-12" />,
  <HeartSticker key="heart" className="absolute bottom-4 left-3 w-5 -rotate-12" />,
  <StarSticker key="star" className="absolute right-3 bottom-3 w-5" />,
  <HeartSticker key="heart" className="absolute bottom-4 left-3 w-5 rotate-12" />,
]

const PILL_CLASS_NAME =
  'inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-blush-deep/70'

/**
 * Below `lg` a horizontal row (thumbnail beside the text); from `lg` a tall card
 * so up to five fit side by side.
 */
export default function ExperienceCard({ experience, index, isSelected, onSelect, onKeyDown, buttonRef }: ExperienceCardProps) {
  const layout = getLayout(experience.layoutId)
  const idPrefix = `experience-${experience.id}`

  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-labelledby={`${idPrefix}-title`}
      aria-describedby={`${idPrefix}-tagline ${idPrefix}-meta`}
      // Roving focus: only the chosen card is in the tab order, arrows move between cards.
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={[
        'group relative flex h-full w-full items-stretch gap-3.5 rounded-[24px] border-2 p-2.5 text-left min-[360px]:p-3',
        'transition-[translate,border-color,box-shadow,background-color] duration-200 ease-out-soft',
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-cocoa',
        'lg:flex-col lg:gap-0 lg:rounded-[28px] lg:p-3',
        isSelected
          ? 'animate-select border-accent bg-linear-to-b from-blush to-white shadow-[0_0_0_4px_rgba(208,75,103,0.14),0_22px_36px_-20px_rgba(176,58,85,0.65)]'
          : 'border-[#f1e1e5] bg-white/90 shadow-[0_14px_28px_-22px_rgba(74,29,36,0.45)] hover:-translate-y-1 hover:border-blush-deep hover:shadow-[0_22px_34px_-20px_rgba(176,58,85,0.5)]',
      ].join(' ')}
    >
      <span
        className={`relative flex w-21 shrink-0 items-center justify-center rounded-[18px] px-2.5 py-3 min-[360px]:w-28 sm:w-32 lg:aspect-16/10 lg:w-full lg:rounded-[22px] lg:p-0 xl:aspect-10/11 ${
          PASTEL_TILE_TONES[index % PASTEL_TILE_TONES.length]
        }`}
      >
        <span className="hidden lg:contents">{TILE_STICKERS[index % TILE_STICKERS.length]}</span>
        <span className="block w-full -rotate-3 overflow-hidden rounded-[4px] shadow-[0_12px_20px_-10px_rgba(74,29,36,0.5)] ring-[3px] ring-white transition-[rotate] duration-300 ease-out-soft group-hover:rotate-0 lg:w-[40%] xl:w-[64%]">
          <PhotoComposition
            layoutId={experience.layoutId}
            frameId={experience.defaultFrameId}
            lookId={experience.defaultLookId}
            placeholder
            imageSizes="(min-width: 1024px) 170px, 110px"
          />
        </span>
        {isSelected ? <HeartSticker className="absolute -top-3 -right-3 z-10 w-8 rotate-12 animate-pop lg:w-10" /> : null}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center py-1 lg:justify-start lg:px-1.5 lg:pt-4 lg:pb-1.5">
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" className="text-[11px] font-semibold text-muted tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span id={`${idPrefix}-title`} className="font-bubble text-[19px] leading-tight font-bold text-cocoa sm:text-[21px]">
              {experience.title}
            </span>
          </span>
          {/* Filled with a check when chosen, so the state never depends on color alone. */}
          <span
            aria-hidden="true"
            className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
              isSelected ? 'animate-pop border-accent bg-accent text-white' : 'border-[#e8d3d8] bg-white'
            }`}
          >
            {isSelected ? <Check size={14} strokeWidth={3} /> : null}
          </span>
        </span>
        <span id={`${idPrefix}-tagline`} className="mt-1 block text-[13px] leading-snug text-ink-soft sm:text-[14px]">
          {experience.tagline}
        </span>
        <span id={`${idPrefix}-meta`} className="mt-3 flex flex-wrap gap-1.5 lg:mt-auto lg:pt-3">
          <span className={PILL_CLASS_NAME}>
            <Images aria-hidden="true" size={13} className="text-accent" />
            {experience.shotCount} ảnh
          </span>
          <span className={PILL_CLASS_NAME}>
            <LayoutGrid aria-hidden="true" size={13} className="text-accent" />
            {layout.label}
          </span>
        </span>
      </span>
    </button>
  )
}
