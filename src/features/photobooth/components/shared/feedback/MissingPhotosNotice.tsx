import { RotateCcw, TriangleAlert } from 'lucide-react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'

type MissingPhotosNoticeProps = {
  count: number
  onRecover: () => void
  disabled?: boolean
}

/** Shown instead of pretending missing photos still exist; offers to re-shoot only those. */
export default function MissingPhotosNotice({ count, onRecover, disabled = false }: MissingPhotosNoticeProps) {
  return (
    // Stacked at every width: it also lives in the narrow Studio/Result sidebars.
    <div role="alert" className="flex shrink-0 flex-col gap-3 rounded-[18px] border border-danger/25 bg-white p-4">
      <div className="flex min-w-0 gap-3">
        <TriangleAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{count} ảnh không còn trên máy này</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
            Ảnh có thể đã mất khi tải lại trang (trình duyệt không cho lưu lâu dài, ví dụ chế độ riêng tư) hoặc bộ
            nhớ trình duyệt đã bị dọn. Các ảnh còn lại vẫn được giữ nguyên.
          </p>
        </div>
      </div>
      <Button onClick={onRecover} disabled={disabled} className="self-start">
        <RotateCcw aria-hidden="true" size={16} />
        Chụp lại {count} ảnh
      </Button>
    </div>
  )
}
