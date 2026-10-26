import { expect, test } from '@playwright/test'
import { captureSession, expectCameraReady, expectRoute, readStorage, startExperience } from './helpers/app'
import { holdCameraRequests } from './helpers/fakeCamera'

declare global {
  interface Window {
    __skeletonReleaseDecode?: () => void
    __skeletonLayoutShifts?: () => { value: number; entries: number }
  }
}

for (const screen of ['ready', 'result'] as const) {
  test(`${screen} hydration keeps loading geometry stable at 430x932`, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    if (screen === 'ready') {
      await startExperience(page, 'Quick 4')
      await expectCameraReady(page)
    } else {
      await captureSession(page, 'Quick 4', 4)
      await page.getByRole('button', { name: /Vào Studio/ }).click()
      await expectRoute(page, '/studio')
      await page.getByRole('button', { name: /Hoàn tất/ }).click()
      await expectRoute(page, '/result')
      await expect(page.getByRole('button', { name: /Tải ảnh PNG/ })).toBeEnabled()
    }

    // Install before the next document's scripts run so hydration itself is
    // measured, including shifts of retained decorations behind the scaffold.
    await page.addInitScript(() => {
      let value = 0
      let entries = 0
      function collect(records: PerformanceEntry[]) {
        for (const record of records) {
          const shift = record as PerformanceEntry & { hadRecentInput: boolean; value: number }
          if (!shift.hadRecentInput) {
            value += shift.value
            entries += 1
          }
        }
      }
      const observer = new PerformanceObserver((list) => collect(list.getEntries()))
      observer.observe({ type: 'layout-shift', buffered: true })
      window.__skeletonLayoutShifts = () => {
        collect(observer.takeRecords())
        return { value, entries }
      }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForURL(new RegExp(`/${screen}/?$`), { waitUntil: 'domcontentloaded' })
    const root = page.locator('[data-motion-root]').filter({ has: page.locator(`#${screen}-title`) })
    await expect(root).toBeVisible()
    await expect(root.locator('.skeleton-block')).toHaveCount(0)
    if (screen === 'ready') await expectCameraReady(page)
    else await expect(page.getByRole('button', { name: /Tải ảnh PNG/ })).toBeEnabled()
    await root.evaluate(async (element) => {
      await document.fonts.ready
      await Promise.all([...element.querySelectorAll('img')].map((image) => image.decode().catch(() => {})))
      await Promise.all(document.getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})))
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    const shifts = await page.evaluate(() => window.__skeletonLayoutShifts!())
    expect(shifts.value, `${screen}: ${shifts.entries} unexpected layout shifts during hydration`).toBeLessThanOrEqual(0.001)
    const geometry = await root.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      pageWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
    expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.pageWidth + 1)
  })
}

test('marketing pages paint immediately without fake full-page skeletons', async ({ page }) => {
  await page.goto('welcome/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[data-skeleton="screen"]')).toHaveCount(0)
  await page.goto('experience/')
  await expect(page.getByRole('radiogroup')).toBeVisible()
  await expect(page.locator('[data-skeleton="screen"]')).toHaveCount(0)
})

test('pending camera shows a skeleton without enabling the shutter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await holdCameraRequests(page)
  await startExperience(page, 'Quick 4')
  const skeleton = page.locator('[data-skeleton="camera"]')
  await expect(skeleton).toBeVisible()
  expect(await skeleton.locator('.skeleton-block').evaluateAll((blocks) => blocks.every((block) => getComputedStyle(block).animationName === 'none'))).toBe(true)
  const pendingBounds = await skeleton.boundingBox()
  await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeDisabled()
  await page.evaluate(() => window.__camera!.settle({}))
  await expect(skeleton).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeEnabled()
  expect(await page.getByLabel('Hình ảnh trực tiếp từ camera').boundingBox()).toEqual(pendingBounds)
})

for (const screen of ['studio', 'result'] as const) {
  test(`${screen} retry skeleton preserves photos that have already loaded`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const captured = await captureSession(page, 'Quick 4', 4)
    await page.getByRole('button', { name: /Vào Studio/ }).click()
    await expectRoute(page, '/studio')
    if (screen === 'result') {
      await page.getByRole('button', { name: /Hoàn tất/ }).click()
      await expectRoute(page, '/result')
    }

    // A fresh document clears the decode cache. Fail one genuine photo read,
    // then hold its retry on a controllable promise rather than a fake delay.
    await page.addInitScript(() => {
      const decode = window.createImageBitmap.bind(window)
      let calls = 0
      window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
        calls += 1
        if (calls === 2) throw new Error('TEST_TRANSIENT_DECODE_FAILURE')
        if (calls === 5) {
          await new Promise<void>((resolve) => { window.__skeletonReleaseDecode = resolve })
        }
        return decode(...args)
      }) as typeof createImageBitmap
    })
    await page.reload()
    await expect(page.getByText('Chưa đọc được 1 ảnh')).toBeVisible()
    const region = page.getByRole('region', { name: screen === 'studio' ? 'Xem trước ảnh hoàn chỉnh' : 'Ảnh hoàn chỉnh', exact: true })
    const readyUrls = await region.locator('img[src^="blob:"]').evaluateAll((images) => [...new Set(images.map((image) => (image as HTMLImageElement).src))])
    expect(readyUrls).toHaveLength(3)

    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    const skeleton = region.locator('[data-skeleton="print"]')
    await expect(skeleton).toBeVisible()
    await expect(skeleton.locator('[data-skeleton-slot="1"]')).toHaveCount(1)
    await expect(skeleton.locator('[data-skeleton-slot]')).toHaveCount(1)
    expect(await skeleton.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    const retainedUrls = await region.locator('img[src^="blob:"]').evaluateAll((images) => [...new Set(images.map((image) => (image as HTMLImageElement).src))])
    expect(retainedUrls).toEqual(readyUrls)
    // No pending slot may cover an image that is already usable, including
    // duplicate thumbnail elements in Studio.
    expect(await region.evaluate((element) => {
      const pending = [...element.querySelectorAll('[data-skeleton-slot]')].map((slot) => slot.getBoundingClientRect())
      return [...element.querySelectorAll<HTMLImageElement>('img[src^="blob:"]')].every((image) => {
        const ready = image.getBoundingClientRect()
        return pending.every((slot) => slot.right <= ready.left || slot.left >= ready.right || slot.bottom <= ready.top || slot.top >= ready.bottom)
      })
    })).toBe(true)
    await expect.poll(() => page.evaluate(() => Boolean(window.__skeletonReleaseDecode))).toBe(true)
    await page.evaluate(() => window.__skeletonReleaseDecode!())
    await expect(skeleton).toHaveCount(0)
    await expect(page.getByText('Chưa đọc được 1 ảnh')).toHaveCount(0)
    expect((await readStorage(page)).session!.shots).toEqual(captured.session!.shots)
  })
}
