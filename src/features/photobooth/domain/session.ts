import {
  getExperience,
  isExperienceId,
  type PhotoboothExperience,
  type PhotoboothExperienceId,
} from '@/src/features/photobooth/config/experiences'
import { isFrameId, type PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import { getLayout, isLayoutId, type PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import { isLookId, type PhotoboothLookId } from '@/src/features/photobooth/domain/looks'

// Pure session rules. Nothing here touches browser storage; callers persist the
// returned value. Every transition returns a new object and throws
// PhotoboothSessionError when an invariant would be broken.

export const SESSION_VERSION = 2

export type PhotoboothCountdown = 0 | 5 | 10 | 15

export const PHOTOBOOTH_COUNTDOWN_OPTIONS: PhotoboothCountdown[] = [0, 5, 10, 15]

const DEFAULT_COUNTDOWN: PhotoboothCountdown = 5

export type PhotoboothSessionStatus =
  | 'created'
  | 'ready'
  | 'capturing'
  | 'reviewing'
  | 'editing'
  | 'completed'

export type PhotoboothRetake = {
  shotIndex: number
  /** Photo taken during the retake; only replaces the original on commit. */
  draftPhotoId: string | null
}

export type PhotoboothSession = {
  version: typeof SESSION_VERSION
  id: string
  experienceId: PhotoboothExperienceId
  layoutId: PhotoboothLayoutId
  shotCount: number
  countdown: PhotoboothCountdown
  /** Original (unfiltered) photo ids by shot index; null until captured. */
  shots: Array<string | null>
  retake: PhotoboothRetake | null
  lookId: PhotoboothLookId
  frameId: PhotoboothFrameId
  status: PhotoboothSessionStatus
  createdAt: number
  updatedAt: number
}

export class PhotoboothSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoboothSessionError'
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PhotoboothSessionError(message)
}

function touch(session: PhotoboothSession, changes: Partial<PhotoboothSession>, now: number): PhotoboothSession {
  return { ...session, ...changes, updatedAt: now }
}

export function createSession(experience: PhotoboothExperience, id: string, now: number): PhotoboothSession {
  assert(getLayout(experience.layoutId).shotCount === experience.shotCount, 'experience layout mismatch')

  return {
    version: SESSION_VERSION,
    id,
    experienceId: experience.id,
    layoutId: experience.layoutId,
    shotCount: experience.shotCount,
    countdown: DEFAULT_COUNTDOWN,
    shots: Array.from({ length: experience.shotCount }, () => null),
    retake: null,
    lookId: experience.defaultLookId,
    frameId: experience.defaultFrameId,
    status: 'created',
    createdAt: now,
    updatedAt: now,
  }
}

export function getCapturedCount(session: PhotoboothSession) {
  return session.shots.filter((shot) => shot !== null).length
}

export function isCaptureComplete(session: PhotoboothSession) {
  return session.shots.every((shot) => shot !== null)
}

/** First empty shot, or -1 when every shot is captured. */
export function getNextShotIndex(session: PhotoboothSession) {
  return session.shots.findIndex((shot) => shot === null)
}

/** The shot the shutter fills next: the retake target, else the first empty slot; null when done. */
export function getCaptureTarget(session: PhotoboothSession): { shotIndex: number; isRetake: boolean } | null {
  if (session.retake) return { shotIndex: session.retake.shotIndex, isRetake: true }
  const shotIndex = getNextShotIndex(session)
  return shotIndex < 0 ? null : { shotIndex, isRetake: false }
}

/**
 * Photos taken by one shutter press: a retake or an untimed press takes one;
 * with a timer the booth runs through every remaining shot on its own.
 */
export function getShotsPerPress(session: PhotoboothSession) {
  if (session.retake) return 1
  const remaining = session.shotCount - getCapturedCount(session)
  return session.countdown === 0 ? Math.min(1, remaining) : remaining
}

/** Ready → Capture: remembers the countdown and unlocks the capture screen. */
export function markReady(session: PhotoboothSession, countdown: PhotoboothCountdown, now: number) {
  assert(!isCaptureComplete(session), 'capture already complete')
  return touch(session, { countdown, status: getCapturedCount(session) > 0 ? 'capturing' : 'ready' }, now)
}

export function recordShot(session: PhotoboothSession, shotIndex: number, photoId: string, now: number) {
  assert(session.retake === null, 'use setRetakeDraft while retaking')
  assert(session.status === 'ready' || session.status === 'capturing', 'session is not capturing')
  assert(Number.isInteger(shotIndex) && shotIndex >= 0 && shotIndex < session.shotCount, 'shot index out of range')
  assert(session.shots[shotIndex] === null, 'shot already captured')

  const shots = [...session.shots]
  shots[shotIndex] = photoId
  return touch(session, { shots, status: 'capturing' }, now)
}

export function completeCapture(session: PhotoboothSession, now: number) {
  assert(session.retake === null, 'retake in progress')
  assert(isCaptureComplete(session), 'capture incomplete')
  return touch(session, { status: 'reviewing' }, now)
}

export function startRetake(session: PhotoboothSession, shotIndex: number, now: number) {
  assert(isCaptureComplete(session), 'retake needs a complete capture')
  assert(Number.isInteger(shotIndex) && shotIndex >= 0 && shotIndex < session.shotCount, 'shot index out of range')
  return touch(session, { retake: { shotIndex, draftPhotoId: null }, status: 'reviewing' }, now)
}

export function setRetakeDraft(session: PhotoboothSession, photoId: string, now: number) {
  assert(session.retake !== null, 'no retake in progress')
  return touch(session, { retake: { ...session.retake, draftPhotoId: photoId } }, now)
}

export function commitRetake(session: PhotoboothSession, now: number) {
  assert(session.retake?.draftPhotoId, 'no retake draft to commit')

  const shots = [...session.shots]
  shots[session.retake.shotIndex] = session.retake.draftPhotoId
  return touch(session, { shots, retake: null, status: 'reviewing' }, now)
}

/** Drops the retake draft; the original shot is untouched. */
export function cancelRetake(session: PhotoboothSession, now: number) {
  return touch(session, { retake: null }, now)
}

function assertEditable(session: PhotoboothSession) {
  assert(isCaptureComplete(session), 'capture incomplete')
  assert(session.retake === null, 'retake in progress')
}

export function enterStudio(session: PhotoboothSession, now: number) {
  assertEditable(session)
  return touch(session, { status: 'editing' }, now)
}

export function setLook(session: PhotoboothSession, lookId: PhotoboothLookId, now: number) {
  assertEditable(session)
  return touch(session, { lookId, status: 'editing' }, now)
}

export function setFrame(session: PhotoboothSession, frameId: PhotoboothFrameId, now: number) {
  assertEditable(session)
  return touch(session, { frameId, status: 'editing' }, now)
}

export function setLayout(session: PhotoboothSession, layoutId: PhotoboothLayoutId, now: number) {
  assertEditable(session)
  assert(getLayout(layoutId).shotCount === session.shotCount, 'layout does not fit the captured shots')
  return touch(session, { layoutId, status: 'editing' }, now)
}

export function completeSession(session: PhotoboothSession, now: number) {
  assertEditable(session)
  return touch(session, { status: 'completed' }, now)
}

/** Every photo the session still needs. */
export function getReferencedPhotoIds(session: PhotoboothSession) {
  const ids = session.shots.filter((shot): shot is string => shot !== null)
  if (session.retake?.draftPhotoId) ids.push(session.retake.draftPhotoId)
  return ids
}

/**
 * Photos a transition stopped referencing (a replaced original, a cancelled or
 * replaced draft). Only these may be deleted after an update: they are computed
 * from the two snapshots of one write, so a photo saved concurrently is never in it.
 */
export function getDroppedPhotoIds(previous: PhotoboothSession, next: PhotoboothSession) {
  if (previous.id !== next.id) return []
  const kept = new Set(getReferencedPhotoIds(next))
  return getReferencedPhotoIds(previous).filter((id) => !kept.has(id))
}

/**
 * Recovery when photos are gone from this device (reload with memory-only
 * storage, cleared site data, undecodable blob). Missing shots become empty so
 * the normal capture flow fills them again; every photo that still exists,
 * plus the look, frame and layout, is kept. When a retake's original is gone
 * but its draft exists, the draft simply takes the slot.
 */
export function releaseMissingShots(session: PhotoboothSession, missingIds: Iterable<string>, now: number) {
  const missing = new Set(missingIds)
  const isMissing = (id: string | null) => id !== null && missing.has(id)
  const shots = session.shots.map((shot) => (isMissing(shot) ? null : shot))

  let retake = session.retake
  if (retake && shots[retake.shotIndex] === null) {
    if (retake.draftPhotoId && !isMissing(retake.draftPhotoId)) shots[retake.shotIndex] = retake.draftPhotoId
    retake = null
  } else if (retake && isMissing(retake.draftPhotoId)) {
    retake = { ...retake, draftPhotoId: null }
  }

  const changed = retake !== session.retake || shots.some((shot, index) => shot !== session.shots[index])
  if (!changed) return session

  const capturedCount = shots.filter((shot) => shot !== null).length
  const status: PhotoboothSessionStatus =
    capturedCount < session.shotCount ? (capturedCount > 0 ? 'capturing' : 'ready') : session.status
  return touch(session, { shots, retake, status }, now)
}

export function getExperiencePrompt(session: PhotoboothSession, shotIndex: number) {
  return getExperience(session.experienceId).prompts[shotIndex] ?? ''
}

const STATUSES: PhotoboothSessionStatus[] = ['created', 'ready', 'capturing', 'reviewing', 'editing', 'completed']

function isPhotoId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}

/**
 * Validates untrusted storage data. Anything that is not a well-formed V2
 * session (including V1 package-based sessions) is rejected rather than guessed.
 */
export function parseSession(value: unknown): PhotoboothSession | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  if (raw.version !== SESSION_VERSION) return null
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null
  if (!isExperienceId(raw.experienceId) || !isLayoutId(raw.layoutId)) return null
  if (!isLookId(raw.lookId) || !isFrameId(raw.frameId)) return null
  if (!STATUSES.includes(raw.status as PhotoboothSessionStatus)) return null
  if (!PHOTOBOOTH_COUNTDOWN_OPTIONS.includes(raw.countdown as PhotoboothCountdown)) return null
  if (typeof raw.createdAt !== 'number' || typeof raw.updatedAt !== 'number') return null

  const experience = getExperience(raw.experienceId)
  if (raw.shotCount !== experience.shotCount) return null
  if (getLayout(raw.layoutId).shotCount !== raw.shotCount) return null

  if (!Array.isArray(raw.shots) || raw.shots.length !== raw.shotCount) return null
  if (!raw.shots.every((shot) => shot === null || isPhotoId(shot))) return null

  let retake: PhotoboothRetake | null = null
  if (raw.retake !== null) {
    const candidate = raw.retake as Record<string, unknown> | undefined
    if (
      typeof candidate !== 'object' ||
      !Number.isInteger(candidate.shotIndex) ||
      (candidate.shotIndex as number) < 0 ||
      (candidate.shotIndex as number) >= raw.shotCount ||
      !(candidate.draftPhotoId === null || isPhotoId(candidate.draftPhotoId))
    ) {
      return null
    }
    retake = { shotIndex: candidate.shotIndex as number, draftPhotoId: candidate.draftPhotoId as string | null }
  }

  return {
    version: SESSION_VERSION,
    id: raw.id,
    experienceId: raw.experienceId,
    layoutId: raw.layoutId,
    shotCount: raw.shotCount as number,
    countdown: raw.countdown as PhotoboothCountdown,
    shots: raw.shots as Array<string | null>,
    retake,
    lookId: raw.lookId,
    frameId: raw.frameId,
    status: raw.status as PhotoboothSessionStatus,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}
