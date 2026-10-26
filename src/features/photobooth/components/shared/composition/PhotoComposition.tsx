import Image from 'next/image'
import SoftImage from '@/src/features/photobooth/components/shared/motion/SoftImage'
import MarketingPhoto from './MarketingPhoto'
import { getFrame, getFrameOverlayUrl, type PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import {
  PRINT_HEIGHT,
  PRINT_WIDTH,
  getLayout,
  type PhotoboothLayoutId,
} from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter, type PhotoboothLookId } from '@/src/features/photobooth/domain/looks'

export type PhotoCompositionProps = {
  layoutId: PhotoboothLayoutId
  frameId: PhotoboothFrameId
  lookId: PhotoboothLookId
  /** Object URLs by shot index. Missing shots render as placeholders or blank paper. */
  photoUrls?: Array<string | null>
  /** Show illustrated sample shots where no photo exists (Welcome/Experience previews). */
  placeholder?: boolean
  dateLabel?: string
  className?: string
  imageSizes?: string
  /** Marketing sections can defer photos while session previews keep their eager behavior. */
  imageLoading?: 'eager' | 'lazy'
  /** Optional static responsive candidates, aligned with photoUrls; never needed for session blobs. */
  photoSrcSets?: string[]
}

const PLACEHOLDER_TONES = [
  ['#EFE4D6', '#D6C3AC'],
  ['#E3E7E1', '#BFC9BE'],
  ['#F1DDD3', '#D7B1A0'],
  ['#E2DFEA', '#BDB7CF'],
  ['#EDE4CC', '#CFBF92'],
  ['#DDE5EA', '#B3C3CC'],
]

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`
}

/** Illustrated sample shot; also used by the Welcome hero strip. */
export function PlaceholderShot({ index }: { index: number }) {
  const [light, deep] = PLACEHOLDER_TONES[index % PLACEHOLDER_TONES.length]
  const people = 1 + (index % 2)

  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${light}, ${deep})` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[78%] w-full" aria-hidden="true">
        <g fill="#1A1714" fillOpacity="0.16">
          {Array.from({ length: people }, (_, person) => {
            const cx = people === 1 ? 50 : 34 + person * 32
            return (
              <g key={person}>
                <circle cx={cx} cy={46} r={13} />
                <path d={`M${cx - 24} 102V86Q${cx - 24} 64 ${cx} 64Q${cx + 24} 64 ${cx + 24} 86V102Z`} />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

/**
 * On-screen print. Slot positions come from the shared layout geometry and
 * photos use object-cover, mirroring renderCompositionPng() pixel for pixel.
 */
export default function PhotoComposition({
  layoutId,
  frameId,
  lookId,
  photoUrls = [],
  placeholder = false,
  dateLabel = '',
  className = '',
  imageSizes = '(max-width: 768px) 45vw, 320px',
  imageLoading = 'eager',
  photoSrcSets,
}: PhotoCompositionProps) {
  const layout = getLayout(layoutId)
  const frame = getFrame(frameId)
  const filter = toCssFilter(getLook(lookId))
  const overlayUrl = getFrameOverlayUrl(layout, frameId, dateLabel)

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${PRINT_WIDTH} / ${PRINT_HEIGHT}`, backgroundColor: frame.paper }}
    >
      {layout.slots.map((slot, slotIndex) => {
        const url = photoUrls[slot.shotIndex] ?? null

        return (
          <div
            key={slotIndex}
            className="absolute overflow-hidden"
            style={{
              left: percent(slot.x, PRINT_WIDTH),
              top: percent(slot.y, PRINT_HEIGHT),
              width: percent(slot.width, PRINT_WIDTH),
              height: percent(slot.height, PRINT_HEIGHT),
              filter,
            }}
          >
            {url ? (
              photoSrcSets?.[slot.shotIndex] ? <MarketingPhoto
                src={url}
                sourceSet={photoSrcSets[slot.shotIndex]}
                loading={imageLoading}
                sizes={imageSizes}
              /> : <SoftImage
                src={url}
                alt=""
                fill
                unoptimized
                loading={imageLoading}
                sizes={imageSizes}
                draggable={false}
                className="object-cover"
              />
            ) : placeholder ? (
              <PlaceholderShot index={slot.shotIndex} />
            ) : (
              <div className="absolute inset-0 bg-paper-deep" />
            )}
          </div>
        )
      })}

      {overlayUrl ? (
        <Image
          src={overlayUrl}
          alt=""
          fill
          unoptimized
          loading="eager"
          sizes={imageSizes}
          draggable={false}
          className="pointer-events-none select-none"
        />
      ) : null}
    </div>
  )
}
