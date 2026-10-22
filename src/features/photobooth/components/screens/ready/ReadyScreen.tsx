'use client'

import { ArrowRight, Timer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CameraViewport from '@/src/features/photobooth/components/shared/camera/CameraViewport'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'
import {
  PHOTOBOOTH_COUNTDOWN_OPTIONS,
  getCapturedCount,
  markReady,
  type PhotoboothCountdown,
} from '@/src/features/photobooth/domain/session'
import { useCamera } from '@/src/features/photobooth/hooks/useCamera'
import { usePhotoboothSession } from '@/src/features/photobooth/hooks/usePhotoboothSession'

const STATUS_COPY = {
  starting: 'Đang mở camera…',
  ready: 'Camera đã sẵn sàng',
  paused: 'Chạm vào khung hình để bật camera',
  error: 'Camera chưa sẵn sàng',
} as const

export default function ReadyScreen() {
  const router = useRouter()
  const { session, isLoaded, update } = usePhotoboothSession(PHOTOBOOTH_ROUTES.READY)
  const camera = useCamera(isLoaded)
  const [pickedCountdown, setPickedCountdown] = useState<PhotoboothCountdown | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function handleReady() {
    if (!isCameraReady || isLeaving) return
    setIsLeaving(true)
    try {
      update((current, now) => markReady(current, countdown, now))
      router.push(PHOTOBOOTH_ROUTES.CAPTURE, { scroll: false })
    } catch {
      setIsLeaving(false)
      setError('Không lưu được phiên chụp. Hãy tải lại trang rồi thử lại.')
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.ready} />

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-8">
        <CameraViewport
          camera={camera}
          filter={toCssFilter(getLook(session.lookId))}
          slot={layout.slots[0]}
        />

        <aside className="flex shrink-0 flex-col gap-4 md:w-[300px] md:[justify-content:safe_center] short:min-h-0 short:gap-3 short:overflow-y-auto">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{experience.title}</p>
            <h1 className="mt-1 font-display text-[clamp(26px,5vw,40px)] font-light leading-tight short:text-[24px]">Hãy vào khung hình.</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft short:hidden">
              Khung hình bên trên chính là phần sẽ được in. Đứng cách màn hình khoảng một sải tay. {experience.shotCount} ảnh ·{' '}
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
          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
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
