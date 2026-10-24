import { CalendarDays, Frame, Images, LayoutGrid, Sparkles } from 'lucide-react'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import type { PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import type { PhotoboothLook } from '@/src/features/photobooth/domain/looks'

export const RESULT_CARD_CLASS_NAME =
  'rounded-[24px] bg-white/85 shadow-[0_14px_30px_-22px_rgba(74,29,36,0.45)] ring-1 ring-blush-deep/60'

const CONFETTI = [
  'top-[6%] left-[2%] h-3 w-1.5 rotate-[25deg] bg-accent',
  'top-[18%] left-[28%] h-2 w-2 rounded-full bg-sunny',
  'top-[2%] right-[18%] h-3 w-1.5 -rotate-[30deg] bg-[#6fb3b8]',
  'bottom-[14%] right-[4%] h-2.5 w-1.5 rotate-[60deg] bg-accent',
  'bottom-[4%] left-[12%] h-2 w-2 rounded-full bg-[#f28fb0]',
]

/** A few static paper bits around the heading; decorative only. */
export function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {CONFETTI.map((className) => (
        <span key={className} className={`absolute rounded-[2px] opacity-80 ${className}`} />
      ))}
    </span>
  )
}

type ResultDetailsProps = {
  shotCount: number
  layoutLabel: string
  experienceTitle: string
  lookLabel: string
  frameLabel: string
  dateLabel: string
}

/** What the print is made of, straight from the session. */
export function ResultDetails({ shotCount, layoutLabel, experienceTitle, lookLabel, frameLabel, dateLabel }: ResultDetailsProps) {
  const rows = [
    { label: 'Bố cục', value: `${shotCount} ảnh · ${layoutLabel}`, icon: <Images aria-hidden="true" size={17} /> },
    { label: 'Trải nghiệm', value: experienceTitle, icon: <LayoutGrid aria-hidden="true" size={17} /> },
    { label: 'Tông màu', value: lookLabel, icon: <Sparkles aria-hidden="true" size={17} /> },
    { label: 'Khung', value: frameLabel, icon: <Frame aria-hidden="true" size={17} /> },
    { label: 'Ngày chụp', value: dateLabel, icon: <CalendarDays aria-hidden="true" size={17} /> },
  ]

  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-2.5 p-4 min-[400px]:grid-cols-2 sm:p-5 ${RESULT_CARD_CLASS_NAME}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blush text-accent">{row.icon}</span>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{row.label}</dt>
            <dd className="truncate text-[14px] font-semibold text-cocoa">{row.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

type OtherLooksProps = {
  looks: PhotoboothLook[]
  layoutId: PhotoboothLayoutId
  frameId: PhotoboothFrameId
  photoUrls: Array<string | null>
  dateLabel: string
  disabled: boolean
  onPick: (look: PhotoboothLook) => void
}

/** The same print in other looks; picking one reopens Studio with that look applied. */
export function OtherLooks({ looks, layoutId, frameId, photoUrls, dateLabel, disabled, onPick }: OtherLooksProps) {
  return (
    <section aria-labelledby="other-looks-title" className={`p-4 sm:p-5 ${RESULT_CARD_CLASS_NAME}`}>
      <h2 id="other-looks-title" className="flex items-center gap-2 font-bubble text-[17px] font-bold text-cocoa">
        <Sparkles aria-hidden="true" size={18} className="text-accent" />
        Tạo phiên bản khác
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-soft">Chọn một tông màu để mở lại Studio với tông đó.</p>
      <ul className="mt-3 grid grid-cols-4 gap-2 sm:gap-2.5">
        {looks.map((look) => (
          <li key={look.id}>
            <button
              type="button"
              onClick={() => onPick(look)}
              disabled={disabled}
              aria-label={`Thử tông ${look.label} trong Studio`}
              className="group flex w-full flex-col items-center gap-1.5 rounded-[16px] bg-white/70 p-1.5 pb-2 ring-1 ring-blush-deep/60 transition-[translate,background-color] duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cocoa disabled:pointer-events-none disabled:opacity-45"
            >
              <span className="block w-full overflow-hidden rounded-[8px] shadow-[0_6px_12px_-8px_rgba(74,29,36,0.5)]">
                <PhotoComposition
                  layoutId={layoutId}
                  frameId={frameId}
                  lookId={look.id}
                  photoUrls={photoUrls}
                  dateLabel={dateLabel}
                  imageSizes="80px"
                />
              </span>
              <span className="text-[12px] font-semibold text-cocoa/80">{look.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
