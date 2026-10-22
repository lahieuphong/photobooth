'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { resolveRouteAccess } from '@/src/features/photobooth/domain/routeGuard'
import { getReferencedPhotoIds, type PhotoboothSession } from '@/src/features/photobooth/domain/session'
import { prunePhotos } from '@/src/features/photobooth/services/storage/photoStore'
import {
  readStoredSession,
  setSessionNotice,
  writeStoredSession,
} from '@/src/features/photobooth/services/storage/sessionStorage'

type SessionMutation = (current: PhotoboothSession, now: number) => PhotoboothSession

/**
 * Loads the session after mount (storage is browser-only, so the prerendered
 * HTML never contains user data) and redirects when the route does not fit it.
 */
export function usePhotoboothSession(route: PhotoboothRoute) {
  const router = useRouter()
  const [session, setSession] = useState<PhotoboothSession | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const { session: stored, discarded } = readStoredSession()
    const access = resolveRouteAccess(route, stored)

    if (!access.allowed) {
      if (access.reason === 'no-session' && discarded) setSessionNotice('session-reset')
      router.replace(access.redirectTo)
      return
    }

    setSession(stored)
    setIsLoaded(true)
  }, [route, router])

  /**
   * Applies a pure transition to the latest stored session (never to a stale
   * React copy), persists it and drops photos the new state no longer uses.
   */
  const update = useCallback((mutate: SessionMutation) => {
    const current = readStoredSession().session
    if (!current) throw new Error('SESSION_MISSING')

    const next = mutate(current, Date.now())
    writeStoredSession(next)
    setSession(next)
    void prunePhotos(next.id, getReferencedPhotoIds(next)).catch(() => undefined)
    return next
  }, [])

  return { session, isLoaded, update }
}
