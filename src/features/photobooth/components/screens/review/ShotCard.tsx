import { RotateCcw, ZoomIn } from 'lucide-react'
import type { CSSProperties } from 'react'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ShotImage from './ShotImage'

type ShotCardProps = {
  index: number
  url: string | null
  isLoading: boolean
  filter: string
  /** Slot shape of this shot in the print, so the card shows exactly the printed crop. */
  aspectRatio: string
  disabled: boolean
  onOpen: () => void
  onRetake: () => void
  style?: CSSProperties
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Polaroid-style card: the photo opens the lightbox, the footer retakes just this shot. */
export default function ShotCard({ index, url, isLoading, filter, aspectRatio, disabled, onOpen, onRetake, style }: ShotCardProps) {
  return (
    <div
      style={style}
      className="group flex animate-rise flex-col rounded-[22px] bg-white p-2 shadow-[0_18px_34px_-24px_rgba(74,29,36,0.55)] ring-1 ring-blush-deep/60 transition-[translate,box-shadow] duration-200 ease-out-soft hover:-translate-y-1 hover:shadow-[0_24px_40px_-24px_rgba(176,58,85,0.6)] sm:p-2.5"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem ảnh ${index + 1}`}
        className="relative block w-full overflow-hidden rounded-[16px] bg-paper-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ aspectRatio }}
      >
        {isLoading && !url ? (
          <Spinner className="absolute inset-0" />
        ) : (
          <ShotImage url={url} filter={filter} fit="cover" sizes="(max-width: 768px) 45vw, 260px" />
        )}
        <span
          aria-hidden="true"
          className="absolute top-2 left-2 grid min-w-8 place-items-center rounded-full bg-white px-2 py-1 font-bubble text-[14px] leading-none font-bold text-cocoa tabular-nums shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]"
        >
          {pad(index + 1)}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-white/90 text-cocoa shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-110"
        >
          <ZoomIn size={16} />
        </span>
      </button>

      <button
        type="button"
        onClick={onRetake}
        disabled={disabled}
        aria-label={`Chụp lại ảnh ${index + 1}`}
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold text-accent-deep transition-colors hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 sm:text-[14px]"
      >
        <RotateCcw aria-hidden="true" size={15} />
        Chụp lại
      </button>
    </div>
  )
}
