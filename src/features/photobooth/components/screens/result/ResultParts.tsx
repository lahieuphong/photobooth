import { ArrowRight, CalendarDays, CircleCheck, Frame, Images, LayoutGrid, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { PANEL_CARD_CLASS_NAME } from '@/src/features/photobooth/components/shared/brand/surfaces'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import type { PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import type { PhotoboothLook } from '@/src/features/photobooth/domain/looks'

const CONFETTI = [
  'top-[6%] left-[2%] h-3 w-1.5 rotate-[25deg] bg-accent',
  'top-[18%] left-[28%] h-2 w-2 rounded-full bg-sunny',
  'top-[2%] right-[18%] h-3 w-1.5 -rotate-[30deg] bg-[#6fb3b8]',
  'bottom-[14%] right-[4%] h-2.5 w-1.5 rotate-[60deg] bg-accent',
  'bottom-[4%] left-[12%] h-2 w-2 rounded-full bg-[#f28fb0]',
  'top-[48%] left-[3%] h-2 w-1 rotate-12 bg-sunny',
  'top-[36%] right-[2%] h-2 w-2 rounded-full bg-blush-deep',
]

/** A single gentle burst of paper bits around the heading; decorative only. */
export function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {CONFETTI.map((className, index) => (
        <span key={className} style={{ animationDelay: `${index * 35}ms` } as CSSProperties} className={`motion-confetti absolute rounded-[2px] opacity-80 ${className}`} />
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
    { label: 'Bố cục', value: `${shotCount} ảnh · ${layoutLabel}`, icon: <Images aria-hidden="true" size={16} /> },
    { label: 'Trải nghiệm', value: experienceTitle, icon: <LayoutGrid aria-hidden="true" size={16} /> },
    { label: 'Tông màu', value: lookLabel, icon: <Sparkles aria-hidden="true" size={16} /> },
    { label: 'Khung', value: frameLabel, icon: <Frame aria-hidden="true" size={16} /> },
    { label: 'Ngày chụp', value: dateLabel, icon: <CalendarDays aria-hidden="true" size={16} /> },
  ]

  return (
    <section aria-labelledby="result-details-title" className={`p-4 sm:p-5 ${PANEL_CARD_CLASS_NAME}`}>
      <h2 id="result-details-title" className="font-bubble text-[16px] font-bold text-cocoa">
        Thông tin tác phẩm
      </h2>
      {/* Sticker tags that wrap: never more than two short lines on a phone. */}
      <dl className="mt-3 flex flex-wrap gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="inline-flex max-w-full items-center gap-2 rounded-full bg-petal py-1.5 pr-3.5 pl-1.5 ring-1 ring-blush-deep/70"
          >
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-accent shadow-[0_3px_6px_-4px_rgba(176,58,85,0.8)]">
              {row.icon}
            </span>
            <dt className="sr-only">{row.label}</dt>
            <dd className="truncate text-[13px] font-semibold text-cocoa">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
    <section aria-labelledby="other-looks-title" className={`p-4 sm:p-5 ${PANEL_CARD_CLASS_NAME}`}>
      <h2 id="other-looks-title" className="flex items-center gap-2 font-bubble text-[17px] font-bold text-cocoa">
        <Sparkles aria-hidden="true" size={18} className="text-accent" />
        Tạo phiên bản khác
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-soft">Chọn một tông màu, Studio sẽ mở lại với tông đó để bạn xem trước.</p>
      <ul className="mt-3 grid grid-cols-4 gap-2 sm:gap-2.5">
        {looks.map((look) => (
          <li key={look.id}>
            <button
              type="button"
              onClick={() => onPick(look)}
              disabled={disabled}
              aria-label={`Thử tông ${look.label} trong Studio`}
              className="group flex w-full flex-col items-center gap-1.5 rounded-[16px] bg-white/70 p-1.5 pb-2 ring-1 ring-blush-deep/60 transition-[translate,background-color,box-shadow] duration-200 ease-out-soft hover:-translate-y-1 hover:bg-white hover:shadow-[0_0_0_2px_var(--color-accent),0_12px_20px_-12px_rgba(176,58,85,0.7)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cocoa disabled:pointer-events-none disabled:opacity-45"
            >
              <span className="block w-full -rotate-2 overflow-hidden rounded-[6px] shadow-[0_6px_12px_-8px_rgba(74,29,36,0.5)] ring-2 ring-white transition-[rotate] duration-200 group-hover:rotate-0">
                <PhotoComposition
                  layoutId={layoutId}
                  frameId={frameId}
                  lookId={look.id}
                  photoUrls={photoUrls}
                  dateLabel={dateLabel}
                  imageSizes="80px"
                />
              </span>
              <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-cocoa/80 group-hover:text-accent-deep">
                {look.label}
                <ArrowRight aria-hidden="true" size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export type ExportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; fileName: string }
  | { status: 'error'; message: string }

/** One line under the download button: the trust note, progress, success or the error. */
export function ExportStatus({ state }: { state: ExportState }) {
  if (state.status === 'error') {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-2xl bg-white/90 px-4 py-3 text-[13px] leading-snug font-medium text-danger ring-1 ring-danger/30">
        <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
        <span>{state.message}</span>
      </p>
    )
  }

  if (state.status === 'done') {
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-[#eaf5ee] px-4 py-3 text-[13px] leading-snug text-cocoa ring-1 ring-success/25">
        <CircleCheck aria-hidden="true" size={16} className="animate-select mt-0.5 shrink-0 text-success" />
        <span>
          Đã tạo <span className="font-semibold break-all">{state.fileName}</span> và chuyển cho trình duyệt tải về. Nếu không thấy tệp
          trong mục Tải về, hãy bấm tải lại.
        </span>
      </p>
    )
  }

  return (
    <p role="status" className="flex items-start justify-center gap-1.5 text-center text-[13px] leading-snug text-ink-soft sm:justify-start sm:text-left">
      <ShieldCheck aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-accent" />
      <span>
        {state.status === 'working'
          ? 'Đang ghép ảnh hoàn chỉnh ngay trên máy này…'
          : 'Ảnh được tạo ngay trên máy này, không tải lên đâu cả.'}
      </span>
    </p>
  )
}

/** Explains what "Chụp phiên mới" deletes; the confirm itself stays on that button. */
export function RestartWarning({ onCancel, disabled }: { onCancel: () => void; disabled: boolean }) {
  return (
    <div role="status" className="motion-panel flex gap-3 rounded-[20px] bg-butter px-4 py-3.5 ring-1 ring-cream">
      <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent-deep" />
      <div className="min-w-0 text-[13px] leading-snug text-cocoa">
        <p className="font-semibold">Bấm “Xác nhận” để bắt đầu phiên mới.</p>
        <p className="mt-1 text-cocoa/80">
          Ảnh của phiên này sẽ bị xóa khỏi bộ nhớ trình duyệt; ảnh PNG đã tải về vẫn được giữ. Hãy tải ảnh về trước nếu muốn giữ.
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="mt-1 inline-flex min-h-11 items-center font-semibold text-accent-deep underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-45"
        >
          Hủy, giữ phiên này
        </button>
      </div>
    </div>
  )
}
