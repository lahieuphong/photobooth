import type { ReactNode } from 'react'
import PhotoComposition, { type PhotoCompositionProps } from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import SoftImage from '@/src/features/photobooth/components/shared/motion/SoftImage'
import { PHOTOBOOTH_FRAMES, type PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayout, PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, toCssFilter, type PhotoboothLookId } from '@/src/features/photobooth/domain/looks'
import { useRadioSelection } from '@/src/features/photobooth/hooks/useRadioSelection'
import StudioOption from './StudioOption'

export type StudioTab = 'look' | 'frame' | 'layout'

type StudioOptionsProps = {
  tab: StudioTab
  label: string
  composition: PhotoCompositionProps
  layouts: readonly PhotoboothLayout[]
  disabled: boolean
  onLookChange: (id: PhotoboothLookId) => void
  onFrameChange: (id: PhotoboothFrameId) => void
  onLayoutChange: (id: PhotoboothLayoutId) => void
}

type Choice = { id: string; label: string; caption?: string; selected: boolean; select: () => void; preview: ReactNode }

/** The active preset group owns presentation and keyboard focus; the session owns all choices. */
export default function StudioOptions({ tab, label, composition, layouts, disabled, onLookChange, onFrameChange, onLayoutChange }: StudioOptionsProps) {
  const photo = composition.photoUrls?.[0]
  const choices: Choice[] = tab === 'look'
    ? PHOTOBOOTH_LOOKS.map((look) => ({
        id: look.id, label: look.label, selected: composition.lookId === look.id,
        select: () => onLookChange(look.id),
        preview: <span className="relative block aspect-square w-full">
          {photo ? <SoftImage src={photo} alt="" fill unoptimized sizes="80px" className="object-cover" style={{ filter: toCssFilter(look) }} /> : null}
        </span>,
      }))
    : tab === 'frame'
      ? PHOTOBOOTH_FRAMES.map((frame) => ({
          id: frame.id, label: frame.label, selected: composition.frameId === frame.id,
          select: () => onFrameChange(frame.id),
          preview: <PhotoComposition {...composition} frameId={frame.id} imageSizes="80px" />,
        }))
      : layouts.map((layout) => ({
          id: layout.id, label: layout.label, caption: `${layout.slots.length} ô`, selected: composition.layoutId === layout.id,
          select: () => onLayoutChange(layout.id),
          preview: <PhotoComposition {...composition} layoutId={layout.id} imageSizes="80px" />,
        }))
  const { optionRefs, handleKeyDown } = useRadioSelection(choices, (choice) => choice.select())

  return (
    <div role="radiogroup" aria-label={label} className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(60px,1fr))] sm:gap-2.5">
      {choices.map((choice, index) => (
        <StudioOption
          key={choice.id}
          label={choice.label}
          caption={choice.caption}
          isSelected={choice.selected}
          disabled={disabled}
          onClick={choice.select}
          onKeyDown={(event) => handleKeyDown(event, index)}
          buttonRef={(element) => { optionRefs.current[index] = element }}
        >
          {choice.preview}
        </StudioOption>
      ))}
    </div>
  )
}
