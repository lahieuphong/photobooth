import { expect, test, type Page } from '@playwright/test'
import { getExperience } from '../../src/features/photobooth/config/experiences'
import { createSession, markReady, type PhotoboothCountdown } from '../../src/features/photobooth/domain/session'
import { capturedCount, expectCameraReady, expectRoute, goToCapture, readStorage, SESSION_KEY, shoot, startExperience } from './helpers/app'
import { failCameraRequests, holdCameraRequests } from './helpers/fakeCamera'

const CLOCK_START = new Date('2026-10-27T00:00:00Z').getTime()
const CLOCK_PAUSE = CLOCK_START + 90_000

declare global {
  interface Window {
    __captureCancellation?: {
      attempts: number
      pendingCanvas?: HTMLCanvasElement
      release?: () => void
    }
  }
}

/** No Ready route has loaded or entered the client router cache yet. */
async function openColdCapture(page: Page, countdown: PhotoboothCountdown) {
  const session = markReady(createSession(getExperience('duo'), `cancel-${test.info().testId}`, CLOCK_START), countdown, CLOCK_START)
  await page.addInitScript(
    ({ key, value }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, value)
    },
    { key: SESSION_KEY, value: JSON.stringify(session) }
  )
  await page.goto('capture/')
  await expectRoute(page, '/capture')
  await expect(page.locator('#capture-title')).toBeVisible()
  await expectCameraReady(page)
}

/** Keep the old Capture mounted while the user has already asked to leave. */
async function holdReadyNavigation(page: Page) {
  let requests = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route((url) => /\/ready\/(?:index\.txt)?$/.test(url.pathname), async (route) => {
    requests += 1
    await gate
    await route.continue()
  })
  return { get requests() { return requests }, release }
}

test.describe('permission', () => {
  test.use({ permissions: [] })

  test('denied, then granted in site settings: the camera recovers by itself', async ({ page, context }) => {
    await startExperience(page, 'Quick 4')
    await expect(page.getByText('Chưa được phép dùng camera')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeDisabled()

    await context.grantPermissions(['camera'])
    await expectCameraReady(page)
    await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeEnabled()
  })
})

test('a busy camera recovers with Retry', async ({ page }) => {
  // Preferred and fallback constraints both fail once the camera is busy.
  await failCameraRequests(page, 'NotReadableError', 2)
  await startExperience(page, 'Quick 4')
  await expect(page.getByText('Camera đang bận')).toBeVisible()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expectCameraReady(page)
  await expect(page.locator('video')).toHaveCount(1)
})

test('startup timeout: no endless spinner, no parallel request, a late stream is used', async ({ page }) => {
  await holdCameraRequests(page)
  await page.clock.install()
  await startExperience(page, 'Quick 4')
  await expect(page.getByText('Đang mở camera…').first()).toBeVisible()

  await page.clock.fastForward(13_000)
  await expect(page.getByText('Camera phản hồi quá lâu').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tải lại trang' })).toBeVisible()
  // getUserMedia cannot be cancelled, so a Retry that starts a second request is never offered.
  await expect(page.getByRole('button', { name: 'Thử lại' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__camera!.calls)).toBe(1)

  await page.evaluate(() => window.__camera!.settle({}))
  await expectCameraReady(page)
  await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeEnabled()
  expect(await page.evaluate(() => window.__camera!.calls)).toBe(1)
})

test('startup timeout followed by a late failure: requests stay sequential and Retry works', async ({ page }) => {
  await holdCameraRequests(page)
  await page.clock.install()
  await startExperience(page, 'Quick 4')
  await page.clock.fastForward(13_000)
  await expect(page.getByText('Camera phản hồi quá lâu').first()).toBeVisible()

  // The preferred request fails late; the looser fallback starts only now, then fails too.
  await page.evaluate(() => window.__camera!.settle({ reject: 'NotReadableError' }))
  await expect.poll(() => page.evaluate(() => window.__camera!.calls)).toBe(2)
  await page.evaluate(() => window.__camera!.settle({ reject: 'NotReadableError' }))
  await expect(page.getByText('Camera đang bận')).toBeVisible()

  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect.poll(() => page.evaluate(() => window.__camera!.calls)).toBe(3)
  await page.evaluate(() => window.__camera!.settle({}))
  await expectCameraReady(page)
})

test('a stream whose playback never starts does not spin forever', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => new Promise<void>(() => undefined)
  })
  await page.clock.install()
  await startExperience(page, 'Quick 4')
  await expect(page.getByText('Đang mở camera…').first()).toBeVisible()
  await page.clock.fastForward(7_000)
  await expect(page.getByText('Camera phản hồi quá lâu').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tải lại trang' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeDisabled()
})

test('double click and repeated Space never take duplicate shots', async ({ page }) => {
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')

  await page.locator('button[aria-label="Chụp"]').dblclick()
  await expect.poll(() => capturedCount(page)).toBe(1)
  await expect(page.locator('button[aria-label="Chụp"]')).toBeEnabled()

  await page.locator('body').press('Space')
  await expect.poll(() => capturedCount(page)).toBe(2)
  await page.locator('body').press('Space')
  await expect.poll(() => capturedCount(page)).toBe(3)
  const { session } = await readStorage(page)
  expect(session!.shots.map((shot) => (shot ? 1 : 0))).toEqual([1, 1, 1, 0])
})

test('reduced motion: the shutter flash never hides the live preview', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')
  await shoot(page, 1)
  await expect(page.locator('.animate-flash')).toHaveCSS('opacity', '0')
})

test('countdown 5s: one press takes every shot', async ({ page }) => {
  await startExperience(page, 'Quick 4')
  await goToCapture(page, '5s')
  await page.getByRole('button', { name: 'Bắt đầu chụp' }).click()
  await expect(page.locator('.animate-pop')).toHaveText('5')
  await expectRoute(page, '/review', 60_000)
  expect(await capturedCount(page)).toBe(4)
})

for (const seconds of [10, 15]) {
  test(`countdown ${seconds}s starts at ${seconds} and stops when leaving mid-countdown`, async ({ page }) => {
    await page.clock.install({ time: CLOCK_START })
    await startExperience(page, 'Duo')
    await goToCapture(page, `${seconds}s`)
    // install() lets real time advance. Freeze only after camera startup so
    // assertion/action latency cannot silently advance to the next shot.
    await page.clock.pauseAt(CLOCK_PAUSE)
    await page.getByRole('button', { name: 'Bắt đầu chụp' }).click()
    await expect(page.locator('.animate-pop')).toHaveText(String(seconds))
    // runFor fires every timer in the window (fastForward would fire each due timer only once).
    await page.clock.runFor(2_000)
    await expect(page.locator('.animate-pop')).toHaveText(String(seconds - 2))
    expect(await capturedCount(page)).toBe(0)

    await page.getByRole('link', { name: /Quay lại/ }).click()
    await expectRoute(page, '/ready')
    await expect(page.locator('#ready-title')).toBeVisible()
    await page.clock.runFor((seconds + 5) * 1000)
    expect(await capturedCount(page)).toBe(0)
  })
}

test('leaving cancels countdown immediately while the destination route is still pending', async ({ page }) => {
  await page.clock.install({ time: CLOCK_START })
  const navigation = await holdReadyNavigation(page)

  try {
    await openColdCapture(page, 10)
    await page.clock.pauseAt(CLOCK_PAUSE)
    await page.evaluate(() => {
      window.__captureCancellation = { attempts: 0 }
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (type === 'image/jpeg') window.__captureCancellation!.attempts += 1
        return original.call(this, callback, type, quality)
      }
    })
    await page.getByRole('button', { name: 'Bắt đầu chụp' }).click()
    await expect(page.locator('.animate-pop')).toHaveText('10')
    await page.clock.runFor(2_000)
    await expect(page.locator('.animate-pop')).toHaveText('8')
    expect(await capturedCount(page)).toBe(0)

    // This navigation is deliberately held; the click must not wait for it.
    await page.getByRole('link', { name: /Quay lại/ }).click({ noWaitAfter: true })
    await expect.poll(() => navigation.requests).toBeGreaterThan(0)
    await expect(page.locator('#capture-title')).toBeVisible()
    await page.clock.runFor(15_000)
    expect(await page.evaluate(() => window.__captureCancellation!.attempts)).toBe(0)
    expect(await capturedCount(page)).toBe(0)

    navigation.release()
    await expectRoute(page, '/ready')
    await expect(page.locator('#ready-title')).toBeVisible()
    expect(await capturedCount(page)).toBe(0)
  } finally {
    navigation.release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('leaving discards a pending frame and preserves photos saved before cancellation', async ({ page }) => {
  const navigation = await holdReadyNavigation(page)

  try {
    await openColdCapture(page, 0)
    await shoot(page, 1)
    await expect.poll(() => capturedCount(page)).toBe(1)
    const before = await readStorage(page)
    expect(before.photos).toHaveLength(1)

    // Hold a real encoded frame rather than a made-up Blob, so cancellation
    // is exercised across captureVideoFrameWithRetry's pending await.
    await page.evaluate(() => {
      const probe = { attempts: 0 } as NonNullable<Window['__captureCancellation']>
      window.__captureCancellation = probe
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (type !== 'image/jpeg') return original.call(this, callback, type, quality)
        probe.attempts += 1
        probe.pendingCanvas = this
        return original.call(this, (blob) => { probe.release = () => callback(blob) }, type, quality)
      }
    })
    await page.getByRole('button', { name: 'Chụp', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Boolean(window.__captureCancellation?.release))).toBe(true)
    await page.getByRole('link', { name: /Quay lại/ }).click({ noWaitAfter: true })
    await expect.poll(() => navigation.requests).toBeGreaterThan(0)
    await expect(page.locator('#capture-title')).toBeVisible()

    await page.evaluate(() => window.__captureCancellation!.release!())
    await expect.poll(() => page.evaluate(() => window.__captureCancellation?.pendingCanvas?.width)).toBe(0)
    const after = await readStorage(page)
    expect(after.session!.shots).toEqual(before.session!.shots)
    expect(after.photos).toEqual(before.photos)
    expect(await page.evaluate(() => window.__captureCancellation!.attempts)).toBe(1)

    navigation.release()
    await expectRoute(page, '/ready')
    await expect(page.locator('#ready-title')).toBeVisible()
    expect((await readStorage(page)).session!.shots).toEqual(before.session!.shots)
  } finally {
    navigation.release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
