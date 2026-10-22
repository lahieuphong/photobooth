import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { resolveRouteAccess, getResumeRoute } from '@/src/features/photobooth/domain/routeGuard'
import {
  completeCapture,
  createSession,
  enterStudio,
  getCaptureTarget,
  getDroppedPhotoIds,
  getShotsPerPress,
  markReady,
  parseSession,
  recordShot,
  releaseMissingShots,
  setLook,
  setRetakeDraft,
  startRetake,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'

const NOW = 1_700_000_000_000

function captured(experienceId: 'quick-4' | 'story-6' = 'quick-4'): PhotoboothSession {
  let session = markReady(createSession(getExperience(experienceId), 'session-1', NOW), 5, NOW)
  for (let index = 0; index < session.shotCount; index += 1) {
    session = recordShot(session, index, `photo-${index}`, NOW)
  }
  return completeCapture(session, NOW)
}

describe('releaseMissingShots', () => {
  test('keeps every existing photo and Studio choice, empties only the missing slots', () => {
    const edited = setLook(enterStudio(captured('story-6'), NOW), 'mono', NOW)
    const released = releaseMissingShots(edited, ['photo-1', 'photo-4'], NOW + 1)

    assert.deepEqual(released.shots, ['photo-0', null, 'photo-2', 'photo-3', null, 'photo-5'])
    assert.equal(released.lookId, 'mono')
    assert.equal(released.layoutId, edited.layoutId)
    assert.equal(released.status, 'capturing')
  })

  test('the capture flow then refills exactly the missing slots', () => {
    const released = releaseMissingShots(captured(), ['photo-2'], NOW)
    assert.deepEqual(getCaptureTarget(released), { shotIndex: 2, isRetake: false })
    assert.equal(getShotsPerPress(released), 1)

    const refilled = completeCapture(recordShot(released, 2, 'photo-2b', NOW), NOW)
    assert.deepEqual(refilled.shots, ['photo-0', 'photo-1', 'photo-2b', 'photo-3'])
  })

  test('every photo missing sends the session back to capture', () => {
    const session = captured()
    const released = releaseMissingShots(session, session.shots as string[], NOW)
    assert.equal(released.status, 'ready')
    assert.equal(getResumeRoute(released), '/capture')
    assert.deepEqual(resolveRouteAccess('/capture', released), { allowed: true })
    assert.equal(resolveRouteAccess('/studio', released).allowed, false)
    assert.equal(resolveRouteAccess('/result', released).allowed, false)
  })

  test('a missing draft is cleared but the retake stays open', () => {
    const withDraft = setRetakeDraft(startRetake(captured(), 1, NOW), 'draft', NOW)
    const released = releaseMissingShots(withDraft, ['draft'], NOW)
    assert.deepEqual(released.retake, { shotIndex: 1, draftPhotoId: null })
    assert.deepEqual(released.shots, withDraft.shots)
    assert.equal(getResumeRoute(released), '/review')
  })

  test('a missing original with a surviving draft promotes the draft', () => {
    const withDraft = setRetakeDraft(startRetake(captured(), 3, NOW), 'draft', NOW)
    const released = releaseMissingShots(withDraft, ['photo-3'], NOW)
    assert.equal(released.retake, null)
    assert.deepEqual(released.shots, ['photo-0', 'photo-1', 'photo-2', 'draft'])
  })

  test('a missing original without a draft becomes a normal capture of that slot', () => {
    const retaking = startRetake(captured(), 0, NOW)
    const released = releaseMissingShots(retaking, ['photo-0'], NOW)
    assert.equal(released.retake, null)
    assert.deepEqual(getCaptureTarget(released), { shotIndex: 0, isRetake: false })
  })

  test('nothing missing leaves the session untouched', () => {
    const session = captured()
    assert.equal(releaseMissingShots(session, ['unrelated'], NOW + 5), session)
  })

  test('the result is still a valid stored session', () => {
    const released = releaseMissingShots(captured('story-6'), ['photo-0'], NOW)
    assert.deepEqual(parseSession(JSON.parse(JSON.stringify(released))), released)
  })

  test('recovery drops references only to the missing photos', () => {
    const session = captured()
    assert.deepEqual(getDroppedPhotoIds(session, releaseMissingShots(session, ['photo-1'], NOW)), ['photo-1'])
  })
})

describe('getDroppedPhotoIds', () => {
  test('ordinary transitions drop nothing', () => {
    const session = captured()
    assert.deepEqual(getDroppedPhotoIds(session, setLook(enterStudio(session, NOW), 'warm', NOW)), [])
    assert.deepEqual(getDroppedPhotoIds(session, startRetake(session, 0, NOW)), [])
  })

  test('never compares two different sessions', () => {
    const a = captured()
    const b = { ...captured(), id: 'session-2', shots: ['x', 'y', 'z', 'w'] }
    assert.deepEqual(getDroppedPhotoIds(a, b), [])
  })
})
