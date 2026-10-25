import { expect, test } from '@playwright/test'
import { captureSession, expectCameraReady, expectRoute, startExperience } from './helpers/app'
import { holdCameraRequests } from './helpers/fakeCamera'
import { expectPerkFooterAtEnd } from './helpers/layout'

for (const title of ['Quick 4', 'Editorial', 'Duo', 'Story 6', 'Play']) {
  test(`${title}: footer stays at the end through Ready, Review and retake`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await startExperience(page, title)
    await expectCameraReady(page)
    await expectPerkFooterAtEnd(page)
    await page.screenshot({ path: info.outputPath('ready-tall-desktop.png'), animations: 'disabled' })
    // Resizing preserves the mounted camera, while the footer follows available height.
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 600 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport)
      await expectPerkFooterAtEnd(page)
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await captureSession(page, title, title === 'Story 6' ? 6 : 4)
    await expectPerkFooterAtEnd(page)
    await page.screenshot({ path: info.outputPath('review-tall-desktop.png'), animations: 'disabled' })
    await page.getByRole('button', { name: 'Chụp lại ảnh 1', exact: true }).click()
    await expectRoute(page, '/capture')
    await expectCameraReady(page)
    await page.getByRole('button', { name: 'Chụp lại', exact: true }).click()
    await expectRoute(page, '/review')
    await expectPerkFooterAtEnd(page)
    await page.getByRole('button', { name: 'Giữ ảnh hiện tại', exact: true }).click()
    await expectPerkFooterAtEnd(page)
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expectPerkFooterAtEnd(page)
  })
}

test('Ready footer follows pending permission, error and recovered camera states', async ({ page }) => {
  await holdCameraRequests(page)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await startExperience(page, 'Editorial')
  await expectPerkFooterAtEnd(page)
  await page.evaluate(() => window.__camera!.settle({ reject: 'NotAllowedError' }))
  await expect(page.getByText('Chưa được phép dùng camera')).toBeVisible()
  await expectPerkFooterAtEnd(page)
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__camera!.calls)).toBe(2)
  await page.evaluate(() => window.__camera!.settle({}))
  await expectCameraReady(page)
  await expectPerkFooterAtEnd(page)
})
