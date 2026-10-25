import { expect, type Page } from '@playwright/test'

/** Checks the user's visible result, including tall pages scrolled to their true end. */
export async function expectPerkFooterAtEnd(page: Page) {
  const footer = page.locator('footer[aria-label="Thông tin trải nghiệm"]')
  const viewport = page.viewportSize()!
  const isShortLandscape = viewport.width > viewport.height && viewport.height <= 540
  if (viewport.width < 768 || isShortLandscape) {
    await expect(footer).toBeHidden()
    return
  }

  await expect(footer).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})))
  })
  const scroller = page.locator('[data-motion-root]')
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const bounds = await footer.evaluate((element) => {
    const root = element.closest('[data-motion-root]')!
    return {
      bottom: element.getBoundingClientRect().bottom,
      top: element.getBoundingClientRect().top,
      viewportBottom: root.getBoundingClientRect().bottom,
      mainBottom: element.parentElement!.getBoundingClientRect().bottom,
      contentBottom: element.previousElementSibling!.getBoundingClientRect().bottom,
      position: getComputedStyle(element).position,
      scrollWidth: root.scrollWidth,
      width: root.clientWidth,
    }
  })
  expect(Math.abs(bounds.bottom - bounds.viewportBottom), 'footer reaches the bottom of the scroller').toBeLessThanOrEqual(1.5)
  expect(Math.abs(bounds.bottom - bounds.mainBottom), 'no empty page space below the footer').toBeLessThanOrEqual(1.5)
  expect(bounds.top, 'footer follows all content without overlapping it').toBeGreaterThanOrEqual(bounds.contentBottom - 1.5)
  expect(bounds.position).toBe('static')
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1)
  // Leave each screen at the top for the next interaction and visual inspection.
  await scroller.evaluate((element) => { element.scrollTop = 0 })
}
