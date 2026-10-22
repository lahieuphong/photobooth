import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { isCaptureComplete, type PhotoboothSession } from '@/src/features/photobooth/domain/session'

/** Where an unfinished session continues from, e.g. when offered on the Experience screen. */
export function getResumeRoute(session: PhotoboothSession): PhotoboothRoute {
  if (!isCaptureComplete(session)) {
    return session.status === 'created' ? PHOTOBOOTH_ROUTES.READY : PHOTOBOOTH_ROUTES.CAPTURE
  }
  if (session.retake) return PHOTOBOOTH_ROUTES.REVIEW
  if (session.status === 'completed') return PHOTOBOOTH_ROUTES.RESULT
  if (session.status === 'editing') return PHOTOBOOTH_ROUTES.STUDIO
  return PHOTOBOOTH_ROUTES.REVIEW
}

export type RouteAccess =
  | { allowed: true }
  | { allowed: false; redirectTo: PhotoboothRoute; reason: 'no-session' | 'wrong-step' }

const ALLOWED: RouteAccess = { allowed: true }

function redirect(redirectTo: PhotoboothRoute, reason: 'no-session' | 'wrong-step' = 'wrong-step'): RouteAccess {
  return { allowed: false, redirectTo, reason }
}

/**
 * Decides whether a screen may render for the current session. Redirects only
 * ever point to Experience or to an earlier/adjacent step whose own rule allows
 * the same session, so guards cannot bounce between each other.
 */
export function resolveRouteAccess(route: PhotoboothRoute, session: PhotoboothSession | null): RouteAccess {
  if (route === PHOTOBOOTH_ROUTES.HOME || route === PHOTOBOOTH_ROUTES.WELCOME || route === PHOTOBOOTH_ROUTES.EXPERIENCE) {
    return ALLOWED
  }

  if (!session) return redirect(PHOTOBOOTH_ROUTES.EXPERIENCE, 'no-session')

  const complete = isCaptureComplete(session)
  const retaking = session.retake !== null

  switch (route) {
    case PHOTOBOOTH_ROUTES.READY:
      return complete ? redirect(PHOTOBOOTH_ROUTES.REVIEW) : ALLOWED

    case PHOTOBOOTH_ROUTES.CAPTURE:
      if (retaking) return ALLOWED
      if (complete) return redirect(PHOTOBOOTH_ROUTES.REVIEW)
      return session.status === 'created' ? redirect(PHOTOBOOTH_ROUTES.READY) : ALLOWED

    case PHOTOBOOTH_ROUTES.REVIEW:
      return complete ? ALLOWED : redirect(PHOTOBOOTH_ROUTES.READY)

    case PHOTOBOOTH_ROUTES.STUDIO:
      if (!complete) return redirect(PHOTOBOOTH_ROUTES.READY)
      return retaking ? redirect(PHOTOBOOTH_ROUTES.REVIEW) : ALLOWED

    case PHOTOBOOTH_ROUTES.RESULT:
      if (!complete) return redirect(PHOTOBOOTH_ROUTES.READY)
      if (retaking) return redirect(PHOTOBOOTH_ROUTES.REVIEW)
      return session.status === 'completed' ? ALLOWED : redirect(PHOTOBOOTH_ROUTES.STUDIO)

    default:
      return ALLOWED
  }
}
