import { expect, test } from '@playwright/test'
import { capturedCount, expectCameraReady, expectRoute, goToCapture, readStorage, shoot, startExperience } from './helpers/app'
import { failCameraRequests, holdCameraRequests } from './helpers/fakeCamera'

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
    await page.clock.install()
    await startExperience(page, 'Duo')
    await goToCapture(page, `${seconds}s`)
    await page.getByRole('button', { name: 'Bắt đầu chụp' }).click()
    await expect(page.locator('.animate-pop')).toHaveText(String(seconds))
    // runFor fires every timer in the window (fastForward would fire each due timer only once).
    await page.clock.runFor(2_000)
    await expect(page.locator('.animate-pop')).toHaveText(String(seconds - 2))

    await page.getByRole('link', { name: /Quay lại/ }).click()
    await expectRoute(page, '/ready')
    await page.clock.runFor((seconds + 5) * 1000)
    expect(await capturedCount(page)).toBe(0)
  })
}
