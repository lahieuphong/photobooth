import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { PHOTOBOOTH_EXPERIENCES, getExperience } from '@/src/features/photobooth/config/experiences'
import { getLayout } from '@/src/features/photobooth/domain/layouts'
import {
  PhotoboothSessionError,
  cancelRetake,
  commitRetake,
  completeCapture,
  completeSession,
  createSession,
  enterStudio,
  getNextShotIndex,
  getReferencedPhotoIds,
  isCaptureComplete,
  markReady,
  parseSession,
  recordShot,
  setFrame,
  setLayout,
  setLook,
  setRetakeDraft,
  startRetake,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'

const NOW = 1_700_000_000_000

function capturedSession(experienceId: Parameters<typeof getExperience>[0] = 'quick-4') {
  let session = markReady(createSession(getExperience(experienceId), 'session-1', NOW), 5, NOW)
  for (let index = 0; index < session.shotCount; index += 1) {
    session = recordShot(session, index, `photo-${index}`, NOW)
  }
  return completeCapture(session, NOW)
}

describe('experience presets', () => {
  for (const experience of PHOTOBOOTH_EXPERIENCES) {
    test(`${experience.id} is internally consistent`, () => {
      assert.equal(getLayout(experience.layoutId).shotCount, experience.shotCount)
      assert.equal(experience.prompts.length, experience.shotCount)
      assert.ok([4, 6].includes(experience.shotCount))
    })
  }

  test('ids are unique', () => {
    const ids = PHOTOBOOTH_EXPERIENCES.map((experience) => experience.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('createSession', () => {
  test('applies experience defaults', () => {
    const session = createSession(getExperience('story-6'), 'abc', NOW)
    assert.equal(session.shotCount, 6)
    assert.equal(session.layoutId, 'grid-6')
    assert.deepEqual(session.shots, [null, null, null, null, null, null])
    assert.equal(session.status, 'created')
    assert.equal(session.retake, null)
  })
})

describe('capture', () => {
  test('records shots in their own slot and moves to capturing', () => {
    let session = markReady(createSession(getExperience('quick-4'), 'abc', NOW), 0, NOW)
    assert.equal(session.status, 'ready')
    assert.equal(session.countdown, 0)

    session = recordShot(session, 2, 'p2', NOW)
    assert.deepEqual(session.shots, [null, null, 'p2', null])
    assert.equal(session.status, 'capturing')
    assert.equal(getNextShotIndex(session), 0)
  })

  test('never overwrites or duplicates a shot', () => {
    const session = recordShot(markReady(createSession(getExperience('quick-4'), 'abc', NOW), 5, NOW), 0, 'p0', NOW)
    assert.throws(() => recordShot(session, 0, 'again', NOW), PhotoboothSessionError)
    assert.throws(() => recordShot(session, 4, 'out', NOW), PhotoboothSessionError)
    assert.throws(() => recordShot(session, -1, 'out', NOW), PhotoboothSessionError)
  })

  test('cannot capture before Ready', () => {
    const session = createSession(getExperience('quick-4'), 'abc', NOW)
    assert.throws(() => recordShot(session, 0, 'p0', NOW), PhotoboothSessionError)
  })

  test('completes only when every shot exists', () => {
    const partial = recordShot(markReady(createSession(getExperience('quick-4'), 'abc', NOW), 5, NOW), 0, 'p0', NOW)
    assert.throws(() => completeCapture(partial, NOW), PhotoboothSessionError)

    const complete = capturedSession()
    assert.equal(complete.status, 'reviewing')
    assert.equal(isCaptureComplete(complete), true)
    assert.equal(getNextShotIndex(complete), -1)
  })

  test('Ready after a reload keeps already captured shots', () => {
    const partial = recordShot(markReady(createSession(getExperience('quick-4'), 'abc', NOW), 5, NOW), 0, 'p0', NOW)
    const again = markReady(partial, 10, NOW)
    assert.equal(again.status, 'capturing')
    assert.deepEqual(again.shots, ['p0', null, null, null])
  })
})

describe('retake', () => {
  test('commit replaces exactly one slot and keeps the total', () => {
    let session = startRetake(capturedSession(), 3, NOW)
    session = setRetakeDraft(session, 'new-3', NOW)
    session = commitRetake(session, NOW)
    assert.deepEqual(session.shots, ['photo-0', 'photo-1', 'photo-2', 'new-3'])
    assert.equal(session.retake, null)
    assert.equal(session.experienceId, 'quick-4')
  })

  test('first slot retake', () => {
    const session = commitRetake(setRetakeDraft(startRetake(capturedSession(), 0, NOW), 'new-0', NOW), NOW)
    assert.deepEqual(session.shots, ['new-0', 'photo-1', 'photo-2', 'photo-3'])
  })

  test('cancel keeps the original photo', () => {
    const session = cancelRetake(setRetakeDraft(startRetake(capturedSession(), 1, NOW), 'draft', NOW), NOW)
    assert.deepEqual(session.shots, ['photo-0', 'photo-1', 'photo-2', 'photo-3'])
    assert.equal(session.retake, null)
  })

  test('draft is referenced until resolved, then garbage', () => {
    const drafting = setRetakeDraft(startRetake(capturedSession(), 1, NOW), 'draft', NOW)
    assert.ok(getReferencedPhotoIds(drafting).includes('draft'))
    assert.ok(getReferencedPhotoIds(drafting).includes('photo-1'))

    const committed = commitRetake(drafting, NOW)
    assert.ok(!getReferencedPhotoIds(committed).includes('photo-1'))

    const cancelled = cancelRetake(drafting, NOW)
    assert.ok(!getReferencedPhotoIds(cancelled).includes('draft'))
  })

  test('cannot commit without a draft or retake an incomplete session', () => {
    assert.throws(() => commitRetake(startRetake(capturedSession(), 1, NOW), NOW), PhotoboothSessionError)
    const partial = markReady(createSession(getExperience('quick-4'), 'abc', NOW), 5, NOW)
    assert.throws(() => startRetake(partial, 0, NOW), PhotoboothSessionError)
    assert.throws(() => startRetake(capturedSession(), 4, NOW), PhotoboothSessionError)
  })

  test('retake from Studio returns the session to reviewing', () => {
    const editing = enterStudio(capturedSession(), NOW)
    const retaking = startRetake(editing, 0, NOW)
    assert.equal(retaking.status, 'reviewing')
    assert.throws(() => enterStudio(retaking, NOW), PhotoboothSessionError)
  })
})

describe('studio', () => {
  test('look and frame changes never touch photos', () => {
    const before = capturedSession()
    const after = setFrame(setLook(before, 'mono', NOW), 'none', NOW)
    assert.deepEqual(after.shots, before.shots)
    assert.equal(after.lookId, 'mono')
    assert.equal(after.frameId, 'none')
    assert.equal(after.status, 'editing')
  })

  test('layout must match the shot count', () => {
    const four = capturedSession('quick-4')
    assert.equal(setLayout(four, 'vertical-4', NOW).layoutId, 'vertical-4')
    assert.throws(() => setLayout(four, 'grid-6', NOW), PhotoboothSessionError)

    const six = capturedSession('story-6')
    assert.throws(() => setLayout(six, 'grid-4', NOW), PhotoboothSessionError)
  })

  test('cannot finish while incomplete', () => {
    const partial = markReady(createSession(getExperience('quick-4'), 'abc', NOW), 5, NOW)
    assert.throws(() => completeSession(partial, NOW), PhotoboothSessionError)
    assert.equal(completeSession(capturedSession(), NOW).status, 'completed')
  })
})

describe('parseSession', () => {
  test('round-trips a valid session', () => {
    const session = setRetakeDraft(startRetake(capturedSession('story-6'), 5, NOW), 'draft', NOW)
    assert.deepEqual(parseSession(JSON.parse(JSON.stringify(session))), session)
  })

  test('rejects the V1 package session shape', () => {
    const legacy = {
      selectedPackageId: 'basic',
      selectedLayoutId: 'layout-grid-4',
      captureRoundsRequired: 2,
      capturedRoundImageDataUrls: [['data:image/jpeg;base64,AAAA']],
    }
    assert.equal(parseSession(legacy), null)
  })

  test('rejects corrupted values', () => {
    const valid = capturedSession()
    const corrupt: Array<Partial<Record<keyof PhotoboothSession, unknown>>> = [
      { shots: ['a', 'b'] },
      { layoutId: 'grid-6' },
      { experienceId: 'museum' },
      { lookId: 'sepia' },
      { countdown: 3 },
      { status: 'paid' },
      { retake: { shotIndex: 9, draftPhotoId: null } },
      { shots: ['a', 'b', 'c', 42] },
    ]
    for (const change of corrupt) {
      assert.equal(parseSession({ ...valid, ...change }), null, JSON.stringify(change))
    }
    assert.equal(parseSession(null), null)
    assert.equal(parseSession('{}'), null)
  })
})
