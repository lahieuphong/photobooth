'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import { Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import FlowHeader from '@/src/features/photobooth/components/shared/layout/FlowHeader'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import {
  PHOTOBOOTH_EXPERIENCES,
  getExperience,
  type PhotoboothExperienceId,
} from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import { SESSION_NOTICE_COPY } from '@/src/features/photobooth/config/sessionNotices'
import { getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import { createSession, getCapturedCount } from '@/src/features/photobooth/domain/session'
import { collectGarbage, endSession } from '@/src/features/photobooth/services/storage/photoStore'
import { claimSession, releaseSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import {
  clearStoredSession,
  consumeSessionNotice,
  readStoredSession,
  setSessionNotice,
  writeStoredSession,
} from '@/src/features/photobooth/services/storage/sessionStorage'
import ExperienceCard from './ExperienceCard'
import ExperienceHeroArt from './ExperienceHeroArt'

const SCREEN = PHOTOBOOTH_SCREENS.experience

const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

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
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let cancelled = false
    const { session, discarded } = readStoredSession()
    const pending = consumeSessionNotice() ?? (discarded ? 'session-reset' : null)
    if (pending) setNotice(SESSION_NOTICE_COPY[pending])

    if (!session) {
      // Removes photos of sessions that were ended or abandoned in closed tabs.
      void collectGarbage([])
      return
    }
    setSelectedId(session.experienceId)
    // A duplicated tab must neither resume nor end the session another tab owns.
    void claimSession(session.id).then((owned) => {
      if (cancelled) return
      if (!owned) {
        clearStoredSession()
        setNotice(SESSION_NOTICE_COPY['duplicate-tab'])
        void collectGarbage([])
        return
      }
      if (getCapturedCount(session) > 0) setResumeRoute(getResumeRoute(session))
      void collectGarbage([session.id])
    })
    return () => {
      cancelled = true
    }
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
    // Only a session this tab owns is ended; a copy from a duplicated tab is simply dropped.
    if (previous && (await claimSession(previous.id))) {
      const { complete } = await endSession(previous.id).catch(() => ({ complete: false }))
      releaseSession(previous.id)
      if (getCapturedCount(previous) > 0 || !complete) setSessionNotice(complete ? 'session-ended' : 'cleanup-incomplete')
    }
    void claimSession(session.id)
    void collectGarbage([session.id])
    router.push(PHOTOBOOTH_ROUTES.READY, { scroll: false })
  }

  /** Radio group keys: arrows move and select (wrapping), Home/End jump to the ends. */
  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = PHOTOBOOTH_EXPERIENCES.length
    let next: number
    if (event.key in ARROW_STEPS) next = (index + ARROW_STEPS[event.key] + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else return

    event.preventDefault()
    setSelectedId(PHOTOBOOTH_EXPERIENCES[next].id)
    optionRefs.current[next]?.focus()
  }

  const statusMessage =
    error ??
    (isConfirmingRestart
      ? 'Ảnh của phiên đang dở sẽ bị xóa khỏi bộ nhớ trình duyệt. Bấm lần nữa để bắt đầu lại.'
      : resumeRoute
        ? 'Bạn còn một phiên chụp đang dở.'
        : null)

  return (
    <BrandPage>
      {/* At least one screen tall, so the action bar rests at the bottom on large displays. */}
      <main className="relative isolate flex min-h-full flex-col">
        <PastelBackdrop />
        <FlowHeader screen={SCREEN} />

        <div className={`${SITE_CONTAINER} flex-1 pb-2`}>
          <div className="mt-2 animate-rise sm:mt-4 lg:mt-2 lg:flex lg:items-end lg:justify-between lg:gap-8 short:mt-1">
            <div className="min-w-0">
              <BubbleHeading
                id="experience-title"
                className="font-bubble text-[clamp(30px,9.4vw,52px)] leading-[1.12] font-extrabold tracking-[-0.01em] text-cocoa lg:text-[clamp(50px,4.6vw,66px)] short:text-[30px]"
                decorations={
                  <>
                    <HeartSticker className="absolute top-[-0.12em] right-[-0.35em] w-[0.55em] rotate-12" />
                    <Doodle className="absolute bottom-[8%] left-[-0.7em] hidden w-[0.5em] -scale-x-100 rotate-180 xl:block" />
                  </>
                }
              >
                <span className="block short:inline">Bạn muốn kể </span>
                <span className="block text-accent short:inline">câu chuyện nào?</span>
              </BubbleHeading>
              <p
                id="experience-subtitle"
                className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft sm:text-[16px] short:mt-1.5 short:text-[13px]"
              >
                Mỗi trải nghiệm đã sắp sẵn số ảnh, bố cục và phong cách. Bạn vẫn chỉnh lại được trong Studio.
              </p>
              {notice ? (
                <p role="status" className="mt-4 max-w-xl rounded-2xl bg-white/80 px-4 py-3 text-[13px] text-ink-soft ring-1 ring-blush-deep">
                  {notice}
                </p>
              ) : null}
            </div>
            <ExperienceHeroArt className="hidden shrink-0 lg:block lg:w-[38%] short:hidden" />
          </div>

          <div
            role="radiogroup"
            aria-labelledby="experience-title"
            aria-describedby="experience-subtitle"
            className="mt-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:justify-center md:gap-4 lg:mt-8 lg:gap-5 xl:flex-nowrap short:mt-4"
          >
            {PHOTOBOOTH_EXPERIENCES.map((experience, index) => (
              <div
                key={experience.id}
                className="flex animate-rise md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2.5rem)/3)] xl:w-auto xl:min-w-0 xl:flex-1"
                style={{ animationDelay: `${80 + index * 50}ms` }}
              >
                <ExperienceCard
                  experience={experience}
                  index={index}
                  isSelected={experience.id === selectedId}
                  onSelect={() => setSelectedId(experience.id)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  buttonRef={(element) => {
                    optionRefs.current[index] = element
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sticky so the CTA is always reachable; in flow, so it never covers the last card. */}
        <div className="sticky bottom-0 z-30 mt-8 border-t border-blush-deep/50 bg-petal/90 backdrop-blur-md short:mt-4">
          <div
            className={`${SITE_CONTAINER} flex flex-col gap-2.5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pt-4 sm:pb-[max(16px,env(safe-area-inset-bottom))] short:pt-2 short:pb-[max(8px,env(safe-area-inset-bottom))]`}
          >
            {/* Phones show only the CTA for the plain hint; screen readers still hear it. */}
            <p
              role={error ? 'alert' : undefined}
              aria-live="polite"
              className={`min-w-0 text-[13px] sm:text-[14px] ${
                error ? 'font-medium text-danger' : statusMessage ? 'text-cocoa' : 'items-center gap-2 max-sm:sr-only sm:flex'
              }`}
            >
              {statusMessage ?? (
                <>
                  <StarSticker className="w-6 shrink-0" />
                  <span className="font-hand text-[18px] leading-tight text-accent-deep lg:text-[21px]">
                    {getExperience(selectedId).description}
                  </span>
                </>
              )}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:shrink-0 sm:flex-row">
              {resumeRoute ? (
                <Button href={resumeRoute} variant="bubble" size="lg" className="w-full sm:w-auto">
                  Tiếp tục phiên cũ
                </Button>
              ) : null}
              <Button
                onClick={() => void handleContinue()}
                disabled={isStarting}
                variant="candy"
                size="lg"
                className="w-full sm:w-auto sm:min-w-52"
              >
                {isConfirmingRestart ? 'Xác nhận bắt đầu lại' : resumeRoute ? 'Bắt đầu lại' : 'Tiếp tục'}
                <ArrowRight aria-hidden="true" size={18} />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </BrandPage>
  )
}
