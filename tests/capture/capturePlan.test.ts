import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import {
  completeCapture,
  createSession,
  getCaptureTarget,
  getShotsPerPress,
  markReady,
  recordShot,
  setRetakeDraft,
  startRetake,
  type PhotoboothCountdown,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'

const NOW = 1

function ready(countdown: PhotoboothCountdown, experienceId: 'quick-4' | 'story-6' = 'quick-4') {
  return markReady(createSession(getExperience(experienceId), 's', NOW), countdown, NOW)
}

/** Simulates the capture loop: one press, writing each photo into the target slot. */
function press(session: PhotoboothSession) {
  let next = session
  const planned = getShotsPerPress(session)
  for (let taken = 0; taken < planned; taken += 1) {
    const target = getCaptureTarget(next)
    if (!target) break
    next = target.isRetake
      ? setRetakeDraft(next, `draft-${taken}`, NOW)
      : recordShot(next, target.shotIndex, `p${target.shotIndex}`, NOW)
  }
  return next
}

describe('capture plan', () => {
  test('timer runs every remaining shot in one press', () => {
    const done = press(ready(5, 'story-6'))
    assert.deepEqual(done.shots, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
    assert.equal(getCaptureTarget(done), null)
  })

  test('no timer takes exactly one shot per press, in order', () => {
    let session = ready(0)
    session = press(session)
    assert.deepEqual(session.shots, ['p0', null, null, null])
    session = press(session)
    session = press(session)
    session = press(session)
    assert.deepEqual(session.shots, ['p0', 'p1', 'p2', 'p3'])
    assert.equal(getShotsPerPress(session), 0)
  })

  test('resuming after a reload continues at the first empty slot', () => {
    const resumed = recordShot(recordShot(ready(10), 0, 'p0', NOW), 1, 'p1', NOW)
    assert.deepEqual(getCaptureTarget(resumed), { shotIndex: 2, isRetake: false })
    assert.equal(getShotsPerPress(resumed), 2)
    assert.deepEqual(press(resumed).shots, ['p0', 'p1', 'p2', 'p3'])
  })

  test('retake takes a single draft for the chosen slot, even with a timer', () => {
    const captured = completeCapture(press(ready(5)), NOW)
    const retaking = startRetake(captured, 3, NOW)
    assert.equal(getShotsPerPress(retaking), 1)
    assert.deepEqual(getCaptureTarget(retaking), { shotIndex: 3, isRetake: true })

    const drafted = press(retaking)
    assert.deepEqual(drafted.shots, captured.shots)
    assert.equal(drafted.retake?.draftPhotoId, 'draft-0')
  })
})
