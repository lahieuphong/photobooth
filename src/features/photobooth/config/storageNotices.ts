import type {
  FallbackReason,
  MemoryOnlyPhoto,
  PhotoStoreStatus,
} from '@/src/features/photobooth/services/storage/photoStore'

const REASON_COPY: Record<FallbackReason, string> = {
  quota: 'bộ nhớ trình duyệt đã đầy',
  unavailable: 'trình duyệt không cho lưu lâu dài (thường gặp ở chế độ riêng tư)',
  error: 'bộ nhớ trình duyệt đang gặp lỗi',
}

/**
 * Warning about reloads for the current session, or null when it is safe.
 * Based on the session's own memory-only photos first (a fact about this
 * session, never inherited by a new one), then on whether storage works now.
 */
export function describeStorageRisk(status: PhotoStoreStatus | null, memoryOnly: MemoryOnlyPhoto[]): string | null {
  if (memoryOnly.length > 0) {
    const reason = memoryOnly[memoryOnly.length - 1].reason
    return `${memoryOnly.length} ảnh chỉ được giữ tạm trong tab này vì ${REASON_COPY[reason]} — đừng tải lại trang trước khi tải ảnh về.`
  }
  if (status?.backend === 'unavailable') {
    return 'Trình duyệt này không cho lưu ảnh lâu dài (thường gặp ở chế độ riêng tư). Ảnh sẽ chỉ được giữ tạm trong tab này — đừng tải lại trang trước khi tải ảnh về.'
  }
  if (status?.backend === 'error') {
    return 'Bộ nhớ trình duyệt đang không phản hồi, nên ảnh mới có thể chỉ được giữ tạm trong tab này.'
  }
  return null
}

/** What a reload would cost right now, for the camera's last-resort reload button. */
export function describeReloadLoss(memoryOnly: MemoryOnlyPhoto[]): string | null {
  return memoryOnly.length > 0 ? `Tải lại trang sẽ mất ${memoryOnly.length} ảnh chỉ được giữ tạm trong tab này.` : null
}
