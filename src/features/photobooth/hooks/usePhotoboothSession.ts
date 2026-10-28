'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { resolveRouteAccess } from '@/src/features/photobooth/domain/routeGuard'
import {
  PhotoboothSessionError,
  getDroppedPhotoIds,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'
import { claimSession } from '@/src/features/photobooth/services/storage/sessionOwnership'
import { deletePhotos, touchSession } from '@/src/features/photobooth/services/storage/photoStore'
import {
  clearStoredSession,
  readSessionForUpdate,
  readStoredSession,
  setSessionNotice,
  writeStoredSession,
} from '@/src/features/photobooth/services/storage/sessionStorage'

type SessionMutation = (current: PhotoboothSession, now: number) => PhotoboothSession

type UpdateOptions = {
  /**
   * Delete the photos this transition stopped referencing (default). Recovery
   * passes false: a photo that merely failed to load right now must survive.
   */
  deleteDropped?: boolean
}

function describeUpdateError(error: unknown) {
  if (error instanceof PhotoboothSessionError) {
    return 'Phiên chụp vừa thay đổi nên thao tác chưa được áp dụng. Hãy thử lại.'
  }
  return 'Không lưu được phiên chụp trên trình duyệt này. Hãy tải lại trang rồi thử lại.'
}

/**
 * Loads the session after mount (storage is browser-only, so the prerendered
 * HTML never contains user data), claims it for this tab and redirects when
 * the route does not fit it.
 */
export function usePhotoboothSession(route: PhotoboothRoute) {
  const router = useRouter()
  const [session, setSession] = useState<PhotoboothSession | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** The session this screen was opened for; writes to any other session are refused. */
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const { session: stored, discarded } = readStoredSession()
    const access = resolveRouteAccess(route, stored)

    if (!access.allowed) {
      if (access.reason === 'no-session' && discarded) setSessionNotice('session-reset')
      router.replace(access.redirectTo)
      return
    }
    if (!stored) {
      setIsLoaded(true)
      return
    }

    void claimSession(stored.id).then((owned) => {
      if (cancelled) return
      if (!owned) {
        // Another tab already works on this session: drop this tab's copy only.
        clearStoredSession()
        setSessionNotice('duplicate-tab')
        router.replace(PHOTOBOOTH_ROUTES.EXPERIENCE)
        return
      }
      sessionIdRef.current = stored.id
      setSession(stored)
      setIsLoaded(true)
      void touchSession(stored.id)
    })

    return () => {
      cancelled = true
    }
  }, [route, router])

  /**
   * Applies a pure transition to the latest stored session (never to a stale
   * React copy) and persists it. Only photos this very transition stopped
   * referencing are deleted. Throws PhotoboothSessionError if the session was
   * replaced since the screen opened, or the storage error if reading or writing failed.
   * Safe to call after unmount, e.g. to attach a photo that finished saving.
   */
  const update = useCallback((mutate: SessionMutation, { deleteDropped = true }: UpdateOptions = {}) => {
    const current = readSessionForUpdate()
    if (!current || current.id !== sessionIdRef.current) throw new PhotoboothSessionError('session changed')

    const next = mutate(current, Date.now())
    writeStoredSession(next)
    setSession(next)

    const dropped = deleteDropped ? getDroppedPhotoIds(current, next) : []
    if (dropped.length > 0) void deletePhotos(dropped)
    void touchSession(next.id)
    return next
  }, [])

  /** update() for event handlers: reports failure in `actionError` instead of throwing. */
  const apply = useCallback(
    (mutate: SessionMutation, options?: UpdateOptions) => {
      try {
        const next = update(mutate, options)
        setActionError(null)
        return next
      } catch (error) {
        setActionError(describeUpdateError(error))
        return null
      }
    },
    [update]
  )

  return { session, isLoaded, update, apply, actionError }
}
