'use client'

import { CameraOff, Play, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import type { PhotoboothLayoutSlot } from '@/src/features/photobooth/domain/layouts'
import type { CameraController } from '@/src/features/photobooth/hooks/useCamera'
import type { CameraErrorKind } from '@/src/features/photobooth/services/camera/cameraStream'

const CAMERA_ERROR_COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  'permission-denied': {
    title: 'Chưa được phép dùng camera',
    body: 'Bấm biểu tượng camera hoặc ổ khóa trên thanh địa chỉ, chọn “Cho phép”, rồi bấm Thử lại.',
  },
  'not-found': {
    title: 'Không tìm thấy camera',
    body: 'Hãy kết nối camera hoặc kiểm tra thiết bị, rồi bấm Thử lại.',
  },
  'in-use': {
    title: 'Camera đang bận',
    body: 'Một ứng dụng hoặc tab khác đang dùng camera. Đóng nó rồi bấm Thử lại.',
  },
  disconnected: {
    title: 'Camera vừa bị ngắt',
    body: 'Kiểm tra lại kết nối camera rồi bấm Thử lại.',
  },
  unsupported: {
    title: 'Trình duyệt chưa hỗ trợ camera',
    body: 'Hãy mở Photobooth bằng Chrome, Safari hoặc Edge phiên bản mới.',
  },
  insecure: {
    title: 'Cần kết nối bảo mật',
    body: 'Camera chỉ hoạt động trên trang https:// hoặc localhost.',
  },
  unknown: {
    title: 'Không mở được camera',
    body: 'Đã có lỗi khi khởi động camera. Bấm Thử lại.',
  },
}

type CameraViewportProps = {
  camera: CameraController
  /** CSS filter previewing the session look on the live image (photos stay unfiltered). */
  filter?: string
  /**
   * Print slot the shot will fill. The viewport takes its shape and the video is
   * cover-cropped into it, which is exactly the crop the print uses: what people
   * see is what gets printed.
   */
  slot: PhotoboothLayoutSlot
  children?: ReactNode
}

export default function CameraViewport({ camera, filter = 'none', slot, children }: CameraViewportProps) {
  const { videoRef, state, mirrored, retry, resume } = camera
  const aspectRatio = slot.width / slot.height

  return (
    <div className="relative flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
      <div
        className="relative overflow-hidden rounded-[24px] bg-ink"
        style={{ aspectRatio, width: `min(100cqw, calc(100cqh * ${aspectRatio}))` }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Hình ảnh trực tiếp từ camera"
          className={[
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            state.status === 'ready' ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{ transform: mirrored ? 'scaleX(-1)' : undefined, filter }}
        />

        {state.status === 'ready' ? (
          // Rule-of-thirds guide for composing the shot.
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
          </div>
        ) : null}

        {state.status === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner tone="light" label="Đang mở camera…" />
          </div>
        ) : null}

        {state.status === 'paused' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <button
              type="button"
              onClick={() => void resume()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-ink"
            >
              <Play aria-hidden="true" size={18} />
              Chạm để bật camera
            </button>
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff aria-hidden="true" size={28} className="text-white/70" />
            <p className="font-display text-[22px] leading-tight">{CAMERA_ERROR_COPY[state.kind].title}</p>
            <p className="max-w-[340px] text-[14px] leading-relaxed text-white/75">{CAMERA_ERROR_COPY[state.kind].body}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-ink"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Thử lại
            </button>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  )
}
