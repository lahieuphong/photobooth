import { expect, test } from '@playwright/test'
import { captureSession, expectRoute, readStorage } from './helpers/app'

test('kiosk off (default): a long idle period never deletes anything', async ({ page }) => {
  await page.clock.install()
  await page.goto('welcome/?kiosk=off')
  const { session } = await captureSession(page, 'Quick 4', 4)

  // One jump (each due timer fires once), then real time again: never fast-forward across a
  // running IndexedDB transaction, or the app's own transaction timeout would fire on fake time.
  await page.clock.fastForward(60 * 60_000)
  await expectRoute(page, '/review')
  const now = await page.evaluate(() => Date.now())
  // The heartbeat kept the open session alive although nobody touched the screen.
  await expect
    .poll(async () => (await readStorage(page)).sessions.find((record) => record.id === session!.id)?.lastActiveAt ?? 0)
    .toBeGreaterThan(now - 5 * 60_000)
  const after = await readStorage(page)
  expect(after.session!.id).toBe(session!.id)
  expect(after.photos.filter((photo) => photo.sessionId === session!.id)).toHaveLength(4)
})

test('kiosk on: warning above any dialog, continue, then expiry deletes the session', async ({ page }) => {
  await page.clock.install()
  // Two minutes: the warning shows for the last 40 seconds.
  await page.goto('welcome/?kiosk=2')
  const { session } = await captureSession(page, 'Quick 4', 4)

  // A photo left open in the lightbox (a top-layer dialog) must not hide the warning.
  await page.getByRole('button', { name: 'Xem ảnh 1' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  // Jump to just before the warning, then run the guard's 1 s ticks deterministically.
  await page.clock.fastForward(78_000)
  await page.clock.runFor(4_000)
  await expect(page.getByText('Bạn vẫn đang dùng chứ?')).toBeVisible()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tiếp tục phiên' }).click()
  await page.clock.runFor(2_000)
  await expect(page.getByText('Bạn vẫn đang dùng chứ?')).toHaveCount(0)
  expect((await readStorage(page)).session!.id).toBe(session!.id)

  // Heartbeats keep running, yet only real activity counts: the session still expires.
  // Two jumps (warning, then expiry); deletion then runs on real time.
  // Idle so far: 2 s (runFor above). Jump into the warning window (80–120 s), then past it.
  await page.clock.fastForward(100_000)
  await expect(page.getByText('Bạn vẫn đang dùng chứ?')).toBeVisible()
  await page.clock.fastForward(20_000)
  await expectRoute(page, '/welcome')
  await expect(page.getByText(/đã được xóa khỏi bộ nhớ trình duyệt/)).toBeVisible()
  const after = await readStorage(page)
  expect(after.session).toBeNull()
  expect(after.photos.filter((photo) => photo.sessionId === session!.id)).toHaveLength(0)

  // Nothing of the previous visitor is reachable afterwards.
  await page.goto('review/')
  await expectRoute(page, '/experience')
  await expect(page.getByRole('link', { name: /Tiếp tục phiên cũ/ })).toHaveCount(0)
})
