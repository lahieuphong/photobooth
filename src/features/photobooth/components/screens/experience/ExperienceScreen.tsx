'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import ScreenHeader from '@/src/features/photobooth/components/shared/layout/ScreenHeader'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import {
  PHOTOBOOTH_EXPERIENCES,
  getExperience,
  type PhotoboothExperienceId,
} from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { SESSION_NOTICE_COPY } from '@/src/features/photobooth/config/sessionNotices'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import { createSession, getCapturedCount } from '@/src/features/photobooth/domain/session'
import { collectGarbage, endSession } from '@/src/features/photobooth/services/storage/photoStore'
import { claimSession, releaseSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import {
  consumeSessionNotice,
  readStoredSession,
  setSessionNotice,
  writeStoredSession,
} from '@/src/features/photobooth/services/storage/sessionStorage'

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export default function ExperienceScreen() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<PhotoboothExperienceId>(PHOTOBOOTH_EXPERIENCES[0].id)
  /** Set when an unfinished session with photos exists; starting over would delete them. */
  const [resumeRoute, setResumeRoute] = useState<PhotoboothRoute | null>(null)
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    const { session, discarded } = readStoredSession()
    if (session) {
      setSelectedId(session.experienceId)
      if (getCapturedCount(session) > 0) setResumeRoute(getResumeRoute(session))
    }
    const pending = consumeSessionNotice() ?? (discarded ? 'session-reset' : null)
    if (pending) setNotice(SESSION_NOTICE_COPY[pending])
    // Removes photos of sessions that were ended or abandoned in closed tabs.
    void collectGarbage(session ? [session.id] : [])
  }, [])

  async function handleContinue() {
    if (isStarting) return
    if (resumeRoute && !isConfirmingRestart) {
      setIsConfirmingRestart(true)
      return
    }
    setIsStarting(true)
    setError(null)

    let session
    const previous = readStoredSession().session
    try {
      session = createSession(getExperience(selectedId), createSessionId(), Date.now())
      writeStoredSession(session)
    } catch {
      setIsStarting(false)
      setError('Không thể bắt đầu phiên chụp. Trình duyệt có thể đang chặn lưu trữ dữ liệu.')
      return
    }

    // The new session is saved first, so a failed cleanup can never leave this tab without one.
    if (previous) {
      const { complete } = await endSession(previous.id).catch(() => ({ complete: false }))
      releaseSession(previous.id)
      if (getCapturedCount(previous) > 0 || !complete) setSessionNotice(complete ? 'session-ended' : 'cleanup-incomplete')
    }
    void claimSession(session.id)
    void collectGarbage([session.id])
    router.push(PHOTOBOOTH_ROUTES.READY, { scroll: false })
  }

  return (
    <ScreenShell>
      <ScreenHeader screen={PHOTOBOOTH_SCREENS.experience} />

      <div className="animate-rise mt-3 shrink-0">
        <h1 className="font-display text-[clamp(30px,6.4vw,52px)] font-light leading-[1.05] tracking-[-0.015em] short:text-[28px]">
          Bạn muốn kể câu chuyện nào?
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-ink-soft sm:text-[15px] short:hidden">
          Mỗi trải nghiệm đã sắp sẵn số ảnh, bố cục và phong cách. Bạn vẫn chỉnh lại được trong Studio.
        </p>
        {notice ? (
          <p role="status" className="mt-3 rounded-2xl bg-paper-deep px-4 py-3 text-[13px] text-ink-soft">
            {notice}
          </p>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-label="Trải nghiệm chụp ảnh"
        className="mt-5 grid min-h-0 flex-1 auto-rows-min content-start gap-2.5 overflow-y-auto overscroll-contain pb-2 short:mt-3 short:grid-cols-2 lg:grid-cols-5 lg:gap-4"
      >
        {PHOTOBOOTH_EXPERIENCES.map((experience, index) => {
          const isSelected = experience.id === selectedId
          const layout = getLayout(experience.layoutId)

          return (
            <button
              key={experience.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedId(experience.id)}
              className={[
                'group grid grid-cols-[52px_1fr] items-center gap-3.5 rounded-[18px] border bg-white px-3 py-2.5 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out-soft',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'sm:grid-cols-[72px_1fr] sm:gap-4 sm:p-3 lg:grid-cols-1 lg:items-start lg:p-4',
                isSelected
                  ? 'border-ink shadow-[0_10px_30px_rgba(26,23,20,0.08)]'
                  : 'border-line hover:border-ink/25',
              ].join(' ')}
            >
              <div className="overflow-hidden rounded-[6px] shadow-[0_6px_16px_rgba(26,23,20,0.1)] lg:mx-auto lg:w-[78%]">
                <PhotoComposition
                  layoutId={experience.layoutId}
                  frameId={experience.defaultFrameId}
                  lookId={experience.defaultLookId}
                  placeholder
                  imageSizes="120px"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="flex items-baseline gap-2 font-display text-[20px] leading-tight sm:text-[22px]">
                    <span className="font-sans text-[11px] font-semibold tabular-nums text-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {experience.title}
                  </p>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full transition-colors ${isSelected ? 'bg-accent' : 'bg-line'}`}
                  />
                </div>
                <p className="mt-0.5 truncate text-[13px] font-medium text-ink-soft">{experience.tagline}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {experience.shotCount} ảnh · {layout.label}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p role={error ? 'alert' : undefined} className={`text-[13px] ${error ? 'text-danger' : 'text-ink-soft'}`} aria-live="polite">
          {error ??
            (isConfirmingRestart
              ? 'Ảnh của phiên đang dở sẽ bị xóa khỏi máy. Bấm lần nữa để bắt đầu lại.'
              : resumeRoute
                ? 'Bạn còn một phiên chụp đang dở.'
                : getExperience(selectedId).description)}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {resumeRoute ? (
            <Button href={resumeRoute} variant="secondary" size="lg">
              Tiếp tục phiên cũ
            </Button>
          ) : null}
          <Button onClick={() => void handleContinue()} disabled={isStarting} size="lg">
            {isConfirmingRestart ? 'Xác nhận bắt đầu lại' : resumeRoute ? 'Bắt đầu lại' : 'Tiếp tục'}
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>
    </ScreenShell>
  )
}
