'use client'

import { Check, Download, PenLine, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FittedComposition from '@/src/features/photobooth/components/shared/composition/FittedComposition'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import MissingPhotosNotice from '@/src/features/photobooth/components/shared/feedback/MissingPhotosNotice'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { formatFrameDate, getFrame } from '@/src/features/photobooth/domain/frames'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook } from '@/src/features/photobooth/domain/looks'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import { enterStudio, releaseMissingShots } from '@/src/features/photobooth/domain/session'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import {
  buildExportFileName,
  downloadBlob,
  renderCompositionPng,
} from '@/src/features/photobooth/services/export/canvasExport'
import { beginBusy } from '@/src/features/photobooth/services/session/activity'
import { endSession } from '@/src/features/photobooth/services/storage/photoStore'
import { releaseSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import { clearStoredSession, setSessionNotice } from '@/src/features/photobooth/services/storage/sessionStorage'

type ExportState = { status: 'idle' } | { status: 'working' } | { status: 'done'; fileName: string } | { status: 'error'; message: string }

function describeExportError(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'PHOTO_MISSING' || code === 'PHOTO_DECODE_FAILED') {
    return 'Thiếu hoặc hỏng ảnh gốc trên máy này nên chưa tạo được ảnh. Hãy chụp lại ảnh bị thiếu.'
  }
  if (code === 'CANVAS_UNAVAILABLE' || code === 'EXPORT_ENCODE_FAILED') {
    return 'Trình duyệt không đủ bộ nhớ để tạo ảnh. Hãy đóng bớt tab khác rồi thử lại.'
  }
  return 'Không tạo được ảnh. Vui lòng thử lại.'
}

export default function ResultScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.RESULT)
  const { urls, isLoading, missingIds } = usePhotoUrls(session?.shots ?? [])
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

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
  const hasMissing = missingIds.length > 0
  const isExporting = exportState.status === 'working'
  const canExport = !isLoading && !hasMissing && !isExporting && !isLeaving

  async function handleDownload() {
    if (!session || !canExport) return
    setExportState({ status: 'working' })
    // An export in progress must not be interrupted by the kiosk idle timer.
    const endBusy = beginBusy()

    try {
      const png = await renderCompositionPng({
        layout,
        frameId: session.frameId,
        lookId: session.lookId,
        shots: session.shots,
        dateLabel,
      })
      const fileName = buildExportFileName(new Date())
      downloadBlob(png, fileName)
      setExportState({ status: 'done', fileName })
    } catch (error) {
      setExportState({ status: 'error', message: describeExportError(error) })
    } finally {
      endBusy()
    }
  }

  function handleEdit() {
    if (isLeaving || isExporting || !apply((current, now) => enterStudio(current, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.STUDIO, { scroll: false })
  }

  function handleRecover() {
    if (isLeaving || isExporting) return
    const next = apply((current, now) => releaseMissingShots(current, missingIds, now), { deleteDropped: false })
    if (!next) return
    setIsLeaving(true)
    router.push(getResumeRoute(next), { scroll: false })
  }

  async function handleRestart() {
    if (!session || isLeaving || isExporting) return
    if (!isConfirmingRestart) {
      setIsConfirmingRestart(true)
      return
    }
    setIsLeaving(true)
    const { complete } = await endSession(session.id).catch(() => ({ complete: false }))
    releaseSession(session.id)
    clearStoredSession()
    setSessionNotice(complete ? 'session-ended' : 'cleanup-incomplete')
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

          {hasMissing ? <MissingPhotosNotice count={missingIds.length} onRecover={handleRecover} disabled={isLeaving || isExporting} /> : null}

          <Button onClick={() => void handleDownload()} disabled={!canExport} size="lg" className="w-full">
            {isExporting ? (
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
              <span className="inline-flex items-start gap-1.5">
                <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-success" />
                <span>
                  Đã tạo {exportState.fileName} và chuyển cho trình duyệt tải về. Nếu không thấy tệp trong mục Tải về,
                  hãy bấm tải lại.
                </span>
              </span>
            ) : exportState.status === 'error' ? (
              exportState.message
            ) : (
              'Ảnh được tạo ngay trên máy này, không tải lên đâu cả.'
            )}
          </p>
          {actionError ? (
            <p role="alert" className="text-[13px] text-danger">
              {actionError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleEdit} disabled={isLeaving || isExporting}>
              <PenLine aria-hidden="true" size={16} />
              Chỉnh sửa lại
            </Button>
            <Button
              variant={isConfirmingRestart ? 'primary' : 'secondary'}
              onClick={() => void handleRestart()}
              disabled={isLeaving || isExporting}
            >
              <RotateCcw aria-hidden="true" size={16} />
              {isLeaving && isConfirmingRestart ? 'Đang xóa…' : isConfirmingRestart ? 'Xác nhận' : 'Chụp phiên mới'}
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
