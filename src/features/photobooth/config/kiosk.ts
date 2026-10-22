// Kiosk mode is for shared/public devices: an idle session is warned about and
// then ended, deleting its photos, so the next visitor never sees them. It is
// off by default; personal devices never lose photos to inactivity.
//
// Turn it on per device by opening any page once with `?kiosk=1` (15 minutes)
// or `?kiosk=<minutes>`, and off with `?kiosk=off`. The choice is remembered in
// localStorage. A build can default it on with NEXT_PUBLIC_PHOTOBOOTH_KIOSK_MINUTES.

export const DEFAULT_KIOSK_IDLE_MINUTES = 15
const MIN_IDLE_MINUTES = 2
const MAX_IDLE_MINUTES = 240
const WARNING_MS = 60_000
/** Personal devices: photos of a session nobody touched for a day are treated as abandoned. */
const PERSONAL_ORPHAN_CUTOFF_MS = 24 * 60 * 60 * 1000
/** Slack for a kiosk tab whose own timer is about to end its session anyway. */
const KIOSK_ORPHAN_MARGIN_MS = 5 * 60_000
const STORAGE_KEY = 'photobooth.kiosk'

export type KioskSettings =
  | { enabled: false }
  | { enabled: true; idleTimeoutMs: number; warningMs: number }

/** `'off'` disables, a number is the idle timeout in minutes, null means "not specified". */
export function parseKioskValue(value: string | null | undefined): number | 'off' | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return null
  if (['0', 'off', 'false', 'no'].includes(normalized)) return 'off'
  if (['1', 'on', 'true', 'yes'].includes(normalized)) return DEFAULT_KIOSK_IDLE_MINUTES

  const minutes = Number(normalized)
  if (!Number.isFinite(minutes)) return null
  return Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, Math.round(minutes)))
}

export function toKioskSettings(value: number | 'off' | null): KioskSettings {
  if (value === null || value === 'off') return { enabled: false }
  const idleTimeoutMs = value * 60_000
  return { enabled: true, idleTimeoutMs, warningMs: Math.min(WARNING_MS, Math.floor(idleTimeoutMs / 3)) }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Applies a `?kiosk=` URL value to this device; call once per page load. */
export function rememberKioskParam(search: string) {
  const value = parseKioskValue(new URLSearchParams(search).get('kiosk'))
  if (value === null) return
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage blocked: the setting then only lasts for this page via the build default.
  }
}

export function getKioskSettings(): KioskSettings {
  let stored: string | null = null
  try {
    stored = getLocalStorage()?.getItem(STORAGE_KEY) ?? null
  } catch {
    stored = null
  }
  const fromDevice = parseKioskValue(stored)
  return toKioskSettings(fromDevice ?? parseKioskValue(process.env.NEXT_PUBLIC_PHOTOBOOTH_KIOSK_MINUTES))
}

/** How long a session record may go untouched before other tabs may collect its photos. */
export function getOrphanCutoffMs() {
  const settings = getKioskSettings()
  return settings.enabled ? settings.idleTimeoutMs + KIOSK_ORPHAN_MARGIN_MS : PERSONAL_ORPHAN_CUTOFF_MS
}
