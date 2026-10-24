import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'

type MissingPhotosNoticeProps = {
  /** Photos confirmed gone from this device. */
  missingCount: number
  /** Photos that could not be read right now; they may still exist. */
  unreadableCount: number
  onRecover: () => void
  onRetry: () => void
  disabled?: boolean
}

/** Shown instead of pretending problem photos still exist; re-shooting is always the user's choice here. */
export default function MissingPhotosNotice({
  missingCount,
  unreadableCount,
  onRecover,
  onRetry,
  disabled = false,
}: MissingPhotosNoticeProps) {
  const total = missingCount + unreadableCount
  const title =
    unreadableCount === 0
      ? `${missingCount} ảnh không còn trên máy này`
      : missingCount === 0
        ? `Chưa đọc được ${unreadableCount} ảnh`
        : `${missingCount} ảnh không còn, ${unreadableCount} ảnh chưa đọc được`

  return (
    // Stacked at every width: it also lives in the narrow Studio/Result sidebars.
    <div role="alert" className="flex shrink-0 flex-col gap-3 rounded-[24px] bg-white/90 p-4 shadow-[0_14px_30px_-22px_rgba(74,29,36,0.45)] ring-1 ring-danger/25 sm:p-5">
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
          <TriangleAlert size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-bubble text-[16px] font-bold text-cocoa">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
            {unreadableCount > 0
              ? 'Trình duyệt chưa đọc được ảnh lúc này (có thể do thiếu bộ nhớ). Ảnh có thể vẫn còn — hãy thử lại trước khi chụp lại.'
              : 'Ảnh có thể đã mất khi tải lại trang (trình duyệt không cho lưu lâu dài, ví dụ chế độ riêng tư) hoặc bộ nhớ trình duyệt đã bị dọn. Các ảnh còn lại vẫn được giữ nguyên.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {unreadableCount > 0 ? (
          <Button variant="bubble" onClick={onRetry} disabled={disabled}>
            <RefreshCw aria-hidden="true" size={16} />
            Thử lại
          </Button>
        ) : null}
        <Button variant="candy" onClick={onRecover} disabled={disabled}>
          <RotateCcw aria-hidden="true" size={16} />
          Chụp lại {total} ảnh
        </Button>
      </div>
    </div>
  )
}
