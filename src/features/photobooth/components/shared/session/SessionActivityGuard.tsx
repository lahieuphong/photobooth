'use client'

import { Clock, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import Spinner from '@/src/features/photobooth/components/shared/feedback/Spinner'
import { getKioskSettings, rememberKioskParam, type KioskSettings } from '@/src/features/photobooth/config/kiosk'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { getIdlePhase, type IdlePhase } from '@/src/features/photobooth/domain/inactivity'
import {
  getLastActivityAt,
  isBusy,
  recordActivity,
  resetActivity,
} from '@/src/features/photobooth/services/session/activity'
import { onPageResume, startSessionHeartbeat } from '@/src/features/photobooth/services/session/heartbeat'
import { collectGarbage, endSession, touchSession } from '@/src/features/photobooth/services/storage/photoStore'
import { claimSession, ownsSession, releaseSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import {
  clearStoredSession,
  peekStoredSessionId,
  readStoredSession,
} from '@/src/features/photobooth/services/storage/sessionStorage'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const KIOSK_GC_MS = 5 * 60_000
/** Collection on resume shares the queue with saving photos; once in a while is enough. */
const RESUME_GC_MIN_INTERVAL_MS = 5 * 60_000
const TOAST_MS = 10_000
/** Client navigation is occasionally dropped on the static export; the session is already gone by then. */
const EXPIRY_NAVIGATION_FALLBACK_MS = 2000

/** Modal dialogs (the Review lightbox) live in the top layer, above any z-index; close them first. */
function closeOpenDialogs() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => (dialog as HTMLDialogElement).close())
}

/**
 * Mounted once in the root layout. On every device it runs the session
 * heartbeat (liveness, independent of interaction), records real user activity
 * (idle clock) and, when the page runs again after being hidden or frozen,
 * refreshes liveness and collects abandoned sessions. Only in kiosk mode does
 * inactivity end the session: a visible warning first, never while a capture
 * or export is running, then every photo of the session is deleted.
 */
export default function SessionActivityGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const [settings, setSettings] = useState<KioskSettings>({ enabled: false })
  const [phase, setPhase] = useState<IdlePhase>({ phase: 'active' })
  const [isExpiring, setIsExpiring] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const expiringRef = useRef(false)

  useEffect(() => {
    rememberKioskParam(window.location.search)
    setSettings(getKioskSettings())
    // Turning kiosk mode on or off in another tab applies here too.
    const refresh = () => setSettings(getKioskSettings())
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  useEffect(() => {
    const handleActivity = () => recordActivity()
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, handleActivity, { capture: true, passive: true }))
    return () => ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handleActivity, { capture: true }))
  }, [])

  useEffect(() => {
    // Screens claim their session as they open; this covers a reload on Welcome,
    // where no screen does, so the stored session keeps its heartbeat.
    const storedId = peekStoredSessionId()
    if (storedId) {
      void claimSession(storedId).then((owned) => {
        if (owned) void touchSession(storedId)
      })
    }

    const stopHeartbeat = startSessionHeartbeat({
      getSessionId: peekStoredSessionId,
      owns: ownsSession,
      touch: (sessionId) => void touchSession(sessionId),
      setInterval: (callback, ms) => setInterval(callback, ms),
      clearInterval: (id) => clearInterval(id),
      onResume: onPageResume,
    })
    // Eventual cleanup: a page that was frozen or in the background catches up when it runs again.
    let lastCollectAt = Date.now()
    const stopCollecting = onPageResume(() => {
      if (Date.now() - lastCollectAt < RESUME_GC_MIN_INTERVAL_MS) return
      lastCollectAt = Date.now()
      const sessionId = peekStoredSessionId()
      void collectGarbage(sessionId ? [sessionId] : [])
    })
    return () => {
      stopHeartbeat()
      stopCollecting()
    }
  }, [])

  const route = pathname.replace(/\/+$/, '') || PHOTOBOOTH_ROUTES.HOME
  const isCover = route === PHOTOBOOTH_ROUTES.WELCOME || route === PHOTOBOOTH_ROUTES.HOME

  useEffect(() => {
    if (!settings.enabled) return
    const { idleTimeoutMs, warningMs } = settings

    async function expire() {
      expiringRef.current = true
      // Cover the screen before anything else so the next visitor never sees the photos.
      closeOpenDialogs()
      setIsExpiring(true)
      try {
        const session = readStoredSession().session
        if (session) {
          const { complete } = await endSession(session.id).catch(() => ({ complete: false }))
          releaseSession(session.id)
          clearStoredSession()
          setToast(
            complete
              ? 'Phiên trước đã kết thúc vì không có thao tác. Ảnh của phiên đó đã được xóa khỏi bộ nhớ trình duyệt.'
              : 'Phiên trước đã kết thúc vì không có thao tác, nhưng một số ảnh chưa xóa được khỏi bộ nhớ trình duyệt. Hệ thống sẽ thử xóa lại.'
          )
        }
        resetActivity()
        setPhase({ phase: 'active' })
        // Already on the cover: no navigation will happen to lift the privacy screen.
        if (isCover) {
          setIsExpiring(false)
        } else {
          router.replace(PHOTOBOOTH_ROUTES.WELCOME)
          window.setTimeout(() => {
            const onCover = /\/welcome\/?$/.test(window.location.pathname)
            if (!onCover) window.location.replace(getAssetPath(`${PHOTOBOOTH_ROUTES.WELCOME}/`))
          }, EXPIRY_NAVIGATION_FALLBACK_MS)
        }
      } finally {
        expiringRef.current = false
      }
    }

    function tick() {
      if (expiringRef.current) return
      const hasSession = peekStoredSessionId() !== null
      if (!hasSession && isCover) {
        setPhase({ phase: 'active' })
        return
      }

      const next = getIdlePhase({
        now: Date.now(),
        lastActivityAt: getLastActivityAt(),
        busy: isBusy(),
        idleTimeoutMs,
        warningMs,
      })
      // Without a session there is nothing to warn about; just return to the cover.
      setPhase(hasSession ? next : { phase: 'active' })
      if (hasSession && next.phase === 'warning') closeOpenDialogs()
      if (next.phase === 'expired') void expire()
    }

    tick()
    const ticker = window.setInterval(tick, 1000)
    const collector = window.setInterval(() => {
      const sessionId = peekStoredSessionId()
      void collectGarbage(sessionId ? [sessionId] : [])
    }, KIOSK_GC_MS)
    return () => {
      window.clearInterval(ticker)
      window.clearInterval(collector)
    }
  }, [settings, isCover, router])

  // The cover stays until the Welcome screen is actually shown.
  useEffect(() => {
    if (isCover) setIsExpiring(false)
  }, [isCover])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <>
      {isExpiring ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-paper">
          <Spinner label="Đang kết thúc phiên…" />
        </div>
      ) : null}

      {phase.phase === 'warning' && !isExpiring ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div
            role="alertdialog"
            aria-labelledby="idle-warning-title"
            aria-describedby="idle-warning-body"
            className="pointer-events-auto flex w-full max-w-[460px] flex-col gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_18px_40px_rgba(26,23,20,0.16)] sm:flex-row sm:items-center"
          >
            <Clock aria-hidden="true" size={22} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p id="idle-warning-title" className="text-[14px] font-semibold">
                Bạn vẫn đang dùng chứ?
              </p>
              <p id="idle-warning-body" className="text-[13px] leading-snug text-ink-soft" aria-live="polite">
                Phiên sẽ tự kết thúc sau {Math.ceil(phase.remainingMs / 1000)} giây và ảnh sẽ bị xóa khỏi bộ nhớ trình duyệt.
              </p>
            </div>
            <Button onClick={() => recordActivity()}>Tiếp tục phiên</Button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-[460px] items-start gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_18px_40px_rgba(26,23,20,0.16)]"
          >
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">{toast}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Đóng thông báo"
              className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-paper-deep"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
