import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'
import { getResumeRoute, resolveRouteAccess } from '@/src/features/photobooth/domain/routeGuard'
import {
  completeCapture,
  completeSession,
  createSession,
  enterStudio,
  markReady,
  recordShot,
  startRetake,
  type PhotoboothSession,
} from '@/src/features/photobooth/domain/session'

const NOW = 1
const { WELCOME, EXPERIENCE, READY, CAPTURE, REVIEW, STUDIO, RESULT } = PHOTOBOOTH_ROUTES
const ROUTES: PhotoboothRoute[] = [WELCOME, EXPERIENCE, READY, CAPTURE, REVIEW, STUDIO, RESULT]

const created = createSession(getExperience('quick-4'), 's', NOW)
const ready = markReady(created, 5, NOW)
const partial = recordShot(ready, 0, 'p0', NOW)
let fullCapture: PhotoboothSession = ready
for (let index = 0; index < 4; index += 1) fullCapture = recordShot(fullCapture, index, `p${index}`, NOW)
const reviewing = completeCapture(fullCapture, NOW)
const retaking = startRetake(reviewing, 1, NOW)
const completed = completeSession(reviewing, NOW)

function target(route: PhotoboothRoute, session: PhotoboothSession | null) {
  const access = resolveRouteAccess(route, session)
  return access.allowed ? route : access.redirectTo
}

describe('route guard', () => {
  test('entry screens are always reachable', () => {
    for (const session of [null, created, completed]) {
      assert.equal(target(WELCOME, session), WELCOME)
      assert.equal(target(EXPERIENCE, session), EXPERIENCE)
    }
  })

  test('deep links without a session go to Experience', () => {
    for (const route of [READY, CAPTURE, REVIEW, STUDIO, RESULT]) {
      const access = resolveRouteAccess(route, null)
      assert.deepEqual(access, { allowed: false, redirectTo: EXPERIENCE, reason: 'no-session' })
    }
  })

  test('step order is enforced', () => {
    assert.equal(target(CAPTURE, created), READY)
    assert.equal(target(CAPTURE, ready), CAPTURE)
    assert.equal(target(CAPTURE, partial), CAPTURE)
    assert.equal(target(REVIEW, partial), READY)
    assert.equal(target(STUDIO, partial), READY)
    assert.equal(target(RESULT, partial), READY)
    assert.equal(target(CAPTURE, reviewing), REVIEW)
    assert.equal(target(READY, reviewing), REVIEW)
    assert.equal(target(RESULT, reviewing), STUDIO)
    assert.equal(target(RESULT, completed), RESULT)
  })

  test('retake only opens Capture and blocks Studio/Result', () => {
    assert.equal(target(CAPTURE, retaking), CAPTURE)
    assert.equal(target(STUDIO, retaking), REVIEW)
    assert.equal(target(RESULT, retaking), REVIEW)
  })

  test('resume route continues each kind of unfinished session on an allowed screen', () => {
    const editing = enterStudio(reviewing, NOW)
    const cases: Array<[PhotoboothSession, PhotoboothRoute]> = [
      [partial, CAPTURE],
      [reviewing, REVIEW],
      [retaking, REVIEW],
      [editing, STUDIO],
      [completed, RESULT],
    ]
    for (const [session, expected] of cases) {
      assert.equal(getResumeRoute(session), expected)
      assert.equal(target(expected, session), expected)
    }
  })

  test('every redirect lands on a screen that accepts the same session', () => {
    for (const session of [null, created, ready, partial, reviewing, retaking, completed]) {
      for (const route of ROUTES) {
        const landing = target(route, session)
        assert.equal(target(landing, session), landing, `${route} → ${landing} must be stable`)
      }
    }
  })
})
