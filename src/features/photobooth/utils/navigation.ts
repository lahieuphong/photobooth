import type { PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

type PushRouter = { push: (href: string, options?: { scroll?: boolean }) => void }

const FALLBACK_AFTER_MS = 900
const POLL_MS = 100

/**
 * Client navigation with a hard-navigation fallback. On the static export some
 * mobile browsers occasionally drop router.push right after heavy camera/canvas
 * work, leaving the user stuck on the capture screen.
 *
 * The fallback is cancelled the moment the URL leaves `from`, so a user who
 * quickly comes back to `from` is never yanked away by a stale timer. Pass
 * `allowHardNavigation: false` when a full reload would lose in-memory data.
 */
export function navigateWithFallback(
  router: PushRouter,
  to: PhotoboothRoute,
  from: PhotoboothRoute,
  { allowHardNavigation = true }: { allowHardNavigation?: boolean } = {}
) {
  router.push(to, { scroll: false })
  if (!allowHardNavigation) return

  const startedAt = Date.now()
  const timer = window.setInterval(() => {
    const stillOnSource = window.location.pathname.replace(/\/+$/, '').endsWith(from)

    if (!stillOnSource) {
      window.clearInterval(timer)
    } else if (Date.now() - startedAt >= FALLBACK_AFTER_MS) {
      window.clearInterval(timer)
      window.location.assign(getAssetPath(`${to}/`))
    }
  }, POLL_MS)
}
