'use client'

import { useEffect, useState } from 'react'

/** Long enough for any real navigation; a screen still mounted after this was not left. */
const UNLOCK_AFTER_MS = 4000

/**
 * Disables a screen's actions while it navigates away (no double submits) and
 * unlocks them again if the navigation was dropped, which happens occasionally
 * on the static export, so buttons never stay disabled for good.
 */
export function useNavigationLock() {
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (!isLeaving) return
    const timer = window.setTimeout(() => setIsLeaving(false), UNLOCK_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [isLeaving])

  return [isLeaving, setIsLeaving] as const
}
