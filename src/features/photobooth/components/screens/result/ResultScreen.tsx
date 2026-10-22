'use client'

import { Check, Download, PenLine, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FittedComposition from '@/src/features/photobooth/components/shared/composition/FittedComposition'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { formatFrameDate, getFrame } from '@/src/features/photobooth/domain/frames'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook } from '@/src/features/photobooth/domain/looks'
import { enterStudio } from '@/src/features/photobooth/domain/session'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import {
  buildExportFileName,
  downloadBlob,
  renderCompositionPng,
} from '@/src/features/photobooth/services/export/canvasExport'
import { deleteSessionPhotos } from '@/src/features/photobooth/services/storage/photoStore'
import { clearStoredSession } from '@/src/features/photobooth/services/storage/sessionStorage'

type ExportState = { status: 'idle' } | { status: 'working' } | { status: 'done'; fileName: string } | { status: 'error'; message: string }

export default function ResultScreen() {
  const router = useRouter()
  const { session, isLoaded, update } = usePhotoboothSession(PHOTOBOOTH_ROUTES.RESULT)
  const { urls } = usePhotoUrls(session?.shots ?? [])
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false)

  if (!isLoaded || !session) {
    return (
      <ScreenShell>
        <ScreenHeader screen={PHOTOBOOTH_SCREENS.result} />
        <Spinner className="flex-1" />
      </ScreenShell>
    )
  }

  const layout = getLayout(session.layoutId)
  const dateLabel = formatFrameDate(session.createdAt)

  async function handleDownload() {
    if (!session || exportState.status === 'working') return
    setExportState({ status: 'working' })

    try {
      const shots = session.shots.filter((shot): shot is string => shot !== null)
      const png = await renderCompositionPng({
        layout,
        frameId: session.frameId,
        lookId: session.lookId,
        shots,
        dateLabel,
      })
      const fileName = buildExportFileName(new Date())
      downloadBlob(png, fileName)
      setExportState({ status: 'done', fileName })
    } catch (error) {
      setExportState({
        status: 'error',
        message:
          error instanceof Error && error.message === 'PHOTO_MISSING'
            ? 'Thiếu ảnh gốc trên máy này. Hãy chụp lại ảnh bị thiếu ở bước Xem lại.'
            : 'Không tạo được ảnh. Vui lòng thử lại.',
      })
    }
  }

  function handleEdit() {
    update((current, now) => enterStudio(current, now))
    router.push(PHOTOBOOTH_ROUTES.STUDIO, { scroll: false })
  }

  async function handleRestart() {
    if (!session) return
    if (!isConfirmingRestart) {
      setIsConfirmingRestart(true)
      return
    }
    await deleteSessionPhotos(session.id).catch(() => undefined)
    clearStoredSession()
    router.push(PHOTOBOOTH_ROUTES.EXPERIENCE, { scroll: false })
  }

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.result} />

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-10">
        <FittedComposition
          layoutId={session.layoutId}
          frameId={session.frameId}
          lookId={session.lookId}
          photoUrls={urls}
          dateLabel={dateLabel}
          imageSizes="(max-width: 768px) 70vw, 480px"
        />

        <aside className="flex shrink-0 flex-col gap-3 md:w-[320px] md:[justify-content:safe_center] short:min-h-0 short:overflow-y-auto">
          <div>
            <h1 className="font-display text-[clamp(28px,5vw,44px)] font-light leading-tight">Tác phẩm của bạn.</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {getExperience(session.experienceId).title} · {layout.label} · {getLook(session.lookId).label} ·{' '}
              {getFrame(session.frameId).label}
            </p>
          </div>

          <Button onClick={() => void handleDownload()} disabled={exportState.status === 'working'} size="lg" className="w-full">
            {exportState.status === 'working' ? (
              'Đang tạo ảnh…'
            ) : (
              <>
                <Download aria-hidden="true" size={18} />
                Tải ảnh PNG
              </>
            )}
          </Button>

          <p
            role={exportState.status === 'error' ? 'alert' : 'status'}
            className={`min-h-[1.5em] text-[13px] ${exportState.status === 'error' ? 'text-danger' : 'text-ink-soft'}`}
          >
            {exportState.status === 'done' ? (
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" size={14} className="text-success" />
                Đã tải {exportState.fileName}
              </span>
            ) : exportState.status === 'error' ? (
              exportState.message
            ) : (
              'Ảnh được tạo ngay trên máy này, không tải lên đâu cả.'
            )}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleEdit}>
              <PenLine aria-hidden="true" size={16} />
              Chỉnh sửa lại
            </Button>
            <Button variant={isConfirmingRestart ? 'primary' : 'secondary'} onClick={() => void handleRestart()}>
              <RotateCcw aria-hidden="true" size={16} />
              {isConfirmingRestart ? 'Xác nhận' : 'Chụp phiên mới'}
            </Button>
          </div>
          {isConfirmingRestart ? (
            <p className="text-[12px] text-ink-soft">
              Ảnh của phiên này sẽ bị xóa khỏi máy. Hãy tải ảnh về trước nếu muốn giữ.{' '}
              <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => setIsConfirmingRestart(false)}>
                Hủy
              </button>
            </p>
          ) : null}
        </aside>
      </div>
    </ScreenShell>
  )
}
