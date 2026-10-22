'use client'

import { ArrowRight, Timer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { SESSION_NOTICE_COPY } from '@/src/features/photobooth/config/sessionNotices'
import { describeReloadLoss, describeStorageRisk } from '@/src/features/photobooth/config/storageNotices'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import {
  PHOTOBOOTH_COUNTDOWN_OPTIONS,
  getCapturedCount,
  getReferencedPhotoIds,
  markReady,
  releaseMissingShots,
  type PhotoboothCountdown,
} from '@/src/features/photobooth/domain/session'
import { useCamera } from '@/src/features/photobooth/hooks/useCamera'
import { useNavigationLock } from '@/src/features/photobooth/hooks/useNavigationLock'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'
import { usePhotoUrls } from '@/src/features/photobooth/hooks/usePhotoUrls'
import {
  getMemoryOnlyPhotos,
  getPhotoStoreStatus,
  type PhotoStoreStatus,
} from '@/src/features/photobooth/services/storage/photoStore'
import { consumeSessionNotice } from '@/src/features/photobooth/services/storage/sessionStorage'

const STATUS_COPY = {
  starting: 'Đang mở camera…',
  'waiting-permission': 'Đang chờ bạn cho phép dùng camera',
  'timed-out': 'Camera phản hồi quá lâu',
  ready: 'Camera đã sẵn sàng',
  paused: 'Chạm vào khung hình để bật camera',
  error: 'Camera chưa sẵn sàng',
} as const

export default function ReadyScreen() {
  const router = useRouter()
  const { session, isLoaded, apply, actionError } = usePhotoboothSession(PHOTOBOOTH_ROUTES.READY)
  const camera = useCamera(isLoaded)
  const { isLoading: isLoadingPhotos, missingIds } = usePhotoUrls(session?.shots ?? [])
  const [pickedCountdown, setPickedCountdown] = useState<PhotoboothCountdown | null>(null)
  const [isLeaving, setIsLeaving] = useNavigationLock()
  const [notice, setNotice] = useState<string | null>(null)
  const [storageStatus, setStorageStatus] = useState<PhotoStoreStatus | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const pending = consumeSessionNotice()
    if (pending) setNotice(SESSION_NOTICE_COPY[pending])
    void getPhotoStoreStatus().then(setStorageStatus)
  }, [isLoaded])

  // Shots already taken but gone from this device are re-taken in Capture.
  const missingKey = missingIds.join('|')
  useEffect(() => {
    if (isLoadingPhotos || !missingKey) return
    apply((current, now) => releaseMissingShots(current, missingKey.split('|'), now), { deleteDropped: false })
  }, [apply, isLoadingPhotos, missingKey])

  if (!isLoaded || !session) {
    return (
      <ScreenShell>
        <ScreenHeader screen={PHOTOBOOTH_SCREENS.ready} />
        <Spinner className="flex-1" />
      </ScreenShell>
    )
  }

  const experience = getExperience(session.experienceId)
  const layout = getLayout(session.layoutId)
  const countdown = pickedCountdown ?? session.countdown
  const capturedCount = getCapturedCount(session)
  const isCameraReady = camera.state.status === 'ready'
  const memoryOnly = getMemoryOnlyPhotos(getReferencedPhotoIds(session))
  const storageNote = describeStorageRisk(storageStatus, memoryOnly)

  function handleReady() {
    if (!isCameraReady || isLeaving) return
    if (!apply((current, now) => markReady(current, countdown, now))) return
    setIsLeaving(true)
    router.push(PHOTOBOOTH_ROUTES.CAPTURE, { scroll: false })
  }

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.ready} />

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-8">
        <CameraViewport
          camera={camera}
          filter={toCssFilter(getLook(session.lookId))}
          slot={layout.slots[0]}
          reloadNote={describeReloadLoss(memoryOnly)}
        />

        <aside className="flex shrink-0 flex-col gap-4 md:w-[300px] md:[justify-content:safe_center] short:min-h-0 short:gap-3 short:overflow-y-auto">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{experience.title}</p>
            <h1 className="mt-1 font-display text-[clamp(26px,5vw,40px)] font-light leading-tight short:text-[24px]">Hãy vào khung hình.</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft short:hidden">
              Khung hình này chính là phần sẽ có trong ảnh. Đứng cách màn hình khoảng một sải tay. {experience.shotCount} ảnh ·{' '}
              {layout.label}
              {capturedCount > 0 ? ` · đã chụp ${capturedCount}` : ''}.
            </p>
          </div>

          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-soft" aria-live="polite">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                isCameraReady ? 'bg-success' : camera.state.status === 'error' ? 'bg-danger' : 'bg-muted'
              }`}
            />
            {STATUS_COPY[camera.state.status]}
          </p>
          {actionError ? (
            <p role="alert" className="text-[13px] text-danger">
              {actionError}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="rounded-2xl bg-paper-deep px-3 py-2 text-[12px] leading-snug text-ink-soft">
              {notice}
            </p>
          ) : null}
          {storageNote ? (
            <p role="status" className="rounded-2xl bg-paper-deep px-3 py-2 text-[12px] leading-snug text-ink-soft">
              {storageNote}
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
              <Timer aria-hidden="true" size={14} />
              Hẹn giờ mỗi ảnh
            </legend>
            <div className="grid grid-cols-4 gap-1 rounded-full bg-paper-deep p-1">
              {PHOTOBOOTH_COUNTDOWN_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === countdown}
                  onClick={() => setPickedCountdown(option)}
                  className={[
                    'h-10 rounded-full text-[14px] font-semibold tabular-nums transition-colors duration-200',
                    option === countdown ? 'bg-white text-ink shadow-[0_2px_8px_rgba(26,23,20,0.08)]' : 'text-ink-soft hover:text-ink',
                  ].join(' ')}
                >
                  {option === 0 ? 'Tắt' : `${option}s`}
                </button>
              ))}
            </div>
          </fieldset>

          <Button onClick={handleReady} disabled={!isCameraReady || isLeaving} size="lg" className="w-full">
            Sẵn sàng chụp
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </aside>
      </div>
    </ScreenShell>
  )
}
