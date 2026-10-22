import type { SessionNotice } from '@/src/features/photobooth/services/storage/sessionStorage'

export const SESSION_NOTICE_COPY: Record<SessionNotice, string> = {
  'session-reset': 'Phiên chụp trước không còn hợp lệ nên đã được làm mới. Hãy chọn một trải nghiệm để bắt đầu.',
  'duplicate-tab':
    'Phiên chụp này đang mở ở một tab khác. Tab này đã được làm mới để không ghi đè ảnh của tab kia.',
  'session-ended': 'Phiên trước đã kết thúc và ảnh của phiên đó đã được xóa khỏi máy này.',
  'cleanup-incomplete':
    'Phiên trước đã kết thúc, nhưng một số ảnh chưa xóa được khỏi bộ nhớ trình duyệt. Hệ thống sẽ thử xóa lại ở lần dọn dẹp sau.',
}
