import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { expectCameraReady, expectRoute, goToCapture, readStorage, shoot } from './helpers/app'
import { holdCameraRequests } from './helpers/fakeCamera'

const VIEWPORTS = [
  [320, 568], [375, 667], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [844, 390],
] as const

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})))
  })
}

async function inspectScreen(page: Page, info: TestInfo, name: string) {
  await settle(page)
  const sizes = await page.locator('[data-motion-root]').evaluate((root) => ({
    width: root.clientWidth, scrollWidth: root.scrollWidth,
    pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
  }))
  expect(sizes.scrollWidth, `${name}: scroll container fits`).toBeLessThanOrEqual(sizes.width + 1)
  expect(sizes.pageScrollWidth, `${name}: page fits`).toBeLessThanOrEqual(sizes.pageWidth + 1)
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' })
}

for (const [width, height] of VIEWPORTS) {
  test(`motion flow and settled layout at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('welcome/')
    await inspectScreen(page, info, 'welcome')
    await page.getByRole('main').getByRole('link', { name: /^Bắt đầu/ }).click()
    await expectRoute(page, '/experience')
    await inspectScreen(page, info, 'experience')
    await page.getByRole('radio', { name: 'Quick 4' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Editorial' })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(page.getByRole('radio', { name: 'Quick 4' })).toBeChecked()
    await page.getByRole('button', { name: /^Tiếp tục/ }).dblclick()
    await expectRoute(page, '/ready')
    await expectCameraReady(page)
    const session = (await readStorage(page)).session!
    await inspectScreen(page, info, 'ready')
    await goToCapture(page, 'Tắt')
    await inspectScreen(page, info, 'capture')
    const video = page.locator('video')
    expect(await video.evaluate((element) => element.getAnimations().length)).toBe(0)
    await expect(page.locator('.animate-float')).toHaveCount(0)
    await shoot(page, 4)
    await expectRoute(page, '/review')
    await inspectScreen(page, info, 'review')
    await page.getByRole('button', { name: 'Xem ảnh 1', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Ảnh 2 trên 4')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Xem ảnh 1', exact: true })).toBeFocused()
    await page.getByRole('button', { name: /Vào Studio/ }).click()
    await expectRoute(page, '/studio')
    for (const name of ['Khung', 'Bố cục', 'Look', 'Khung', 'Look']) {
      await page.getByRole('tab', { name, exact: true }).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
    }
    await page.getByRole('radio', { name: 'Warm', exact: true }).click()
    await inspectScreen(page, info, 'studio')
    await page.getByRole('button', { name: /Hoàn tất/ }).click()
    await expectRoute(page, '/result')
    await expect(page.locator('.motion-confetti')).toHaveCount(7)
    await inspectScreen(page, info, 'result')
    const after = (await readStorage(page)).session!
    expect(after.id).toBe(session.id)
    expect(after.shots.filter(Boolean)).toHaveLength(4)
    expect(after.lookId).toBe('warm')
    // Re-rendering a warning must leave the completed celebration alone.
    const confetti = page.locator('.motion-confetti').first()
    const node = await confetti.elementHandle()
    await page.getByRole('button', { name: /Chụp phiên mới/ }).click()
    expect(await confetti.evaluate((element, previous) => element === previous, node)).toBe(true)
    await expect(page.getByText(/Ảnh của phiên này sẽ bị xóa/)).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('reveal uses the page scroller, survives fast scrolling, and never hides again', async ({ page }) => {
  await page.goto('welcome/')
  const heading = page.locator('#ve-chung-minh-title')
  await expect(heading).toHaveCSS('opacity', '0')
  const root = page.locator('[data-motion-root]')
  await root.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toHaveCSS('opacity', '1')
  for (let index = 0; index < 3; index += 1) {
    await root.evaluate((element) => { element.scrollTop = 0 })
    await root.evaluate((element) => { element.scrollTop = element.scrollHeight })
  }
  await root.evaluate((element) => { element.scrollTop = 0 })
  await expect(heading).toHaveCSS('opacity', '1')
  const heart = page.locator('.hero-collage .animate-float').first()
  await expect(heart).toHaveCSS('animation-play-state', 'running')
  await root.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(heart).toHaveCSS('animation-play-state', 'paused')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('reduced motion reveals pending content and keeps countdown/flash usable', async ({ page }) => {
  await page.goto('welcome/')
  const heading = page.locator('#ve-chung-minh-title')
  await expect(heading).toHaveCSS('opacity', '0')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(heading).toHaveCSS('opacity', '1')
  await expect(page.locator('.hero-collage .animate-float').first()).toHaveCSS('animation-name', 'none')
  await page.goto('experience/')
  await page.getByRole('button', { name: /^Tiếp tục/ }).click()
  await expectRoute(page, '/ready')
  await goToCapture(page, '5s')
  await page.getByRole('button', { name: 'Bắt đầu chụp', exact: true }).click()
  const number = page.locator('.animate-pop')
  await expect(number).toBeVisible()
  await expect(number).toHaveCSS('animation-name', 'none')
  await expect(number).toHaveCSS('transform', 'none')
  await expect(page.locator('.animate-flash')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('.animate-flash')).toHaveCSS('opacity', '0')
})

test('camera permission and timer feedback never recreate the stream or video', async ({ page }) => {
  await holdCameraRequests(page)
  await page.goto('experience/')
  await page.getByRole('button', { name: /^Tiếp tục/ }).click()
  await expectRoute(page, '/ready')
  await expect(page.getByRole('button', { name: /Sẵn sàng chụp/ })).toBeDisabled()
  await expect(page.getByText('Đang mở camera…').first()).toBeVisible()
  const node = await page.locator('video').elementHandle()
  for (const name of ['5s', '10s', '15s', 'Tắt']) await page.getByRole('button', { name, exact: true }).click()
  expect(await page.evaluate(() => window.__camera!.calls)).toBe(1)
  expect(await page.locator('video').evaluate((element, previous) => element === previous, node)).toBe(true)
  await page.evaluate(() => window.__camera!.settle({}))
  await expectCameraReady(page)
  for (const name of ['5s', '10s', 'Tắt']) await page.getByRole('button', { name, exact: true }).click()
  expect(await page.locator('video').evaluate((element, previous) => element === previous, node)).toBe(true)
  await page.getByRole('button', { name: /Sẵn sàng chụp/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
  expect(await page.evaluate(() => window.__camera!.calls)).toBe(1)
})

test('ambient motion pauses when hidden and resumes on return', async ({ page }) => {
  await page.goto('welcome/')
  const sticker = page.locator('.hero-collage .animate-float').first()
  await expect(sticker).toHaveCSS('animation-play-state', 'running')
  // Deterministic visibility event: browsers throttle background pages differently in headless CI.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(sticker).toHaveCSS('animation-play-state', 'paused')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(sticker).toHaveCSS('animation-play-state', 'running')
})

test('server HTML stays visible without JavaScript or IntersectionObserver', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  await page.goto('welcome/')
  await expect(page.locator('#ve-chung-minh-title')).toHaveCSS('opacity', '1')
  await expect(page.getByRole('main').getByRole('link', { name: /^Bắt đầu/ })).toBeVisible()
  await context.close()
  const fallback = await browser.newPage({ baseURL })
  await fallback.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined }) })
  await fallback.goto('welcome/')
  await expect(fallback.locator('#ve-chung-minh-title')).toHaveCSS('opacity', '1')
  await fallback.getByRole('main').getByRole('link', { name: /^Bắt đầu/ }).click()
  await expectRoute(fallback, '/experience')
  await fallback.close()
})

test('slow images keep their geometry and become visible after loading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/images/demo/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })
  await page.goto('welcome/', { waitUntil: 'domcontentloaded' })
  const image = page.locator('.hero-collage img').first()
  const box = await image.boundingBox()
  expect(box!.width).toBeGreaterThan(0)
  expect(box!.height).toBeGreaterThan(0)
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  await expect(image).toHaveCSS('opacity', '1')
  expect(await image.boundingBox()).toEqual(box)
})

test('touch and 200% layout zoom keep navigation reachable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('welcome/')
  await page.getByRole('main').getByRole('link', { name: /^Bắt đầu/ }).tap()
  await expectRoute(page, '/experience')
  await page.getByRole('radio', { name: 'Duo', exact: true }).tap()
  await expect(page.getByRole('radio', { name: 'Duo', exact: true })).toBeChecked()
  await context.close()
  const zoom = await browser.newPage({ baseURL, viewport: { width: 1280, height: 800 } })
  await zoom.goto('welcome/')
  await zoom.evaluate(() => { document.documentElement.style.zoom = '2' })
  await zoom.getByRole('main').getByRole('link', { name: /^Bắt đầu/ }).click()
  await expectRoute(zoom, '/experience')
  await expect(zoom.getByRole('button', { name: /^Tiếp tục/ })).toBeInViewport()
  await zoom.close()
})
