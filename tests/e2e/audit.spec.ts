import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { captureSession, expectRoute, readStorage, SESSION_KEY } from './helpers/app'
import { inspectExport } from './helpers/export'

type MemoryProbe = {
  liveBitmaps: number
  peakBitmaps: number
  decodeCalls: number
  failDecodeAt: number | null
  urls: Map<string, string>
  revokedWhileDisplayed: string[]
}

declare global {
  interface Window {
    __auditStoredSession?: () => string | null
    __auditMemory?: MemoryProbe
  }
}

test('blocked session reads keep Experience usable and never overwrite unknown session data', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((key) => {
    const read = Storage.prototype.getItem
    sessionStorage.setItem(key, 'existing data must survive')
    window.__auditStoredSession = () => read.call(sessionStorage, key)
    Storage.prototype.getItem = () => { throw new DOMException('Blocked by the test', 'SecurityError') }
  }, SESSION_KEY)
  await page.goto('experience/')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByText(/Không thể bắt đầu phiên chụp/)).toBeVisible()
  await page.getByRole('button', { name: /^Tiếp tục/ }).click()
  await expectRoute(page, '/experience')
  expect(await page.evaluate(() => window.__auditStoredSession!())).toBe('existing data must survive')
  expect(errors).toEqual([])
})

test('Studio radio groups support arrows, Home/End and one tab stop without changing photos', async ({ page }) => {
  const before = await captureSession(page, 'Quick 4', 4)
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await expectRoute(page, '/studio')
  for (const tab of ['Look', 'Khung', 'Bố cục']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    const radios = page.getByRole('radio')
    const count = await radios.count()
    await page.getByRole('radio', { checked: true }).focus()
    await page.keyboard.press('Home')
    await expect(radios.first()).toBeFocused()
    await expect(radios.first()).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(radios.nth(Math.min(1, count - 1))).toBeFocused()
    await expect(radios.nth(Math.min(1, count - 1))).toBeChecked()
    await page.keyboard.press('End')
    await expect(radios.last()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(radios.first()).toBeFocused()
    await expect(radios.first()).toBeChecked()
    expect(await radios.evaluateAll((elements) => elements.filter((element) => element.getAttribute('tabindex') === '0').length)).toBe(1)
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
  }
  expect((await readStorage(page)).session!.shots).toEqual(before.session!.shots)
})

test('repeated exports and a decode failure release bitmaps and retired photo URLs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const probe: MemoryProbe = { liveBitmaps: 0, peakBitmaps: 0, decodeCalls: 0, failDecodeAt: null, urls: new Map(), revokedWhileDisplayed: [] }
    window.__auditMemory = probe
    const createBitmap = window.createImageBitmap.bind(window)
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      probe.decodeCalls += 1
      if (probe.decodeCalls === probe.failDecodeAt) throw new Error('TEST_DECODE_FAILURE')
      const bitmap = await createBitmap(...args)
      probe.liveBitmaps += 1
      probe.peakBitmaps = Math.max(probe.peakBitmaps, probe.liveBitmaps)
      const close = bitmap.close.bind(bitmap)
      bitmap.close = () => { probe.liveBitmaps -= 1; close() }
      return bitmap
    }) as typeof createImageBitmap
    const createUrl = URL.createObjectURL.bind(URL)
    const revokeUrl = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const url = createUrl(blob)
      probe.urls.set(url, blob instanceof Blob ? blob.type : '')
      return url
    }
    URL.revokeObjectURL = (url) => {
      if ([...document.images].some((image) => image.src === url)) probe.revokedWhileDisplayed.push(url)
      probe.urls.delete(url)
      revokeUrl(url)
    }
  })

  await captureSession(page, 'Story 6', 6)
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await page.getByRole('button', { name: /Hoàn tất/ }).click()
  await expectRoute(page, '/result')
  await expect(page.getByRole('button', { name: /Tải ảnh PNG/ })).toBeEnabled()
  for (let index = 0; index < 3; index += 1) {
    await page.evaluate(() => { window.__auditMemory!.peakBitmaps = 0 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Tải ảnh PNG/ }).click()])
    expect(await download.failure()).toBeNull()
    expect(await page.evaluate(() => ({ live: window.__auditMemory!.liveBitmaps, peak: window.__auditMemory!.peakBitmaps }))).toEqual({ live: 0, peak: 1 })
  }

  await page.evaluate(() => {
    const probe = window.__auditMemory!
    probe.decodeCalls = 0
    probe.failDecodeAt = 2
  })
  await page.getByRole('button', { name: /Tải ảnh PNG/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: /Thiếu hoặc hỏng ảnh gốc/ })).toBeVisible()
  expect(await page.evaluate(() => window.__auditMemory!.liveBitmaps)).toBe(0)
  await page.evaluate(() => { window.__auditMemory!.failDecodeAt = null })
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Tải ảnh PNG/ }).click()])
  await page.getByRole('button', { name: /Chụp phiên mới/ }).click()
  await page.getByRole('button', { name: /^Xác nhận/ }).click()
  await expectRoute(page, '/experience')
  await expect.poll(() => page.evaluate(() => [...window.__auditMemory!.urls.values()].filter((type) => type === 'image/jpeg').length)).toBe(0)
  // Downloads hold their PNG URL briefly for browsers that read it after click().
  await expect.poll(() => page.evaluate(() => window.__auditMemory!.urls.size), { timeout: 15_000 }).toBe(0)
  expect(await page.evaluate(() => window.__auditMemory!.revokedWhileDisplayed)).toEqual([])
})

test('HTMLImage decoding and pixel-filter fallback still export the same print', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'createImageBitmap', { configurable: true, value: undefined })
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', { configurable: true, get: () => 'none', set: () => {} })
  })
  await captureSession(page, 'Duo', 4)
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await page.getByRole('button', { name: /Hoàn tất/ }).click()
  await expectRoute(page, '/result')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Tải ảnh PNG/ }).click()])
  const png = await readFile((await download.path())!)
  const result = await inspectExport(page, png)
  expect(result.width).toBe(1800)
  expect(result.height).toBe(2349)
  expect(result.meanDiff).toBeLessThan(6)
  expect(result.photoDiffersFromPaper).toBe(true)
})
