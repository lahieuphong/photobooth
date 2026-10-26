import { expect, test } from '@playwright/test'

for (const route of ['welcome', 'experience']) {
  test(`${route}: critical headline is visible in static HTML without waiting for hydration or entrance effects`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(`${route}/`)
    const heading = page.locator(`#${route}-title`)
    await expect(heading).toBeVisible()
    const animations = await heading.locator('span').first().evaluate((element) => {
      const result = []
      for (let current: Element | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current)
        result.push({ animation: style.animationName, opacity: style.opacity })
      }
      return result
    })
    expect(animations.every((style) => style.animation === 'none' && style.opacity === '1')).toBe(true)
    await context.close()
  })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`responsive marketing images stay sharp and load on scroll at ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const failures: string[] = []
    page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()) })
    for (const route of ['welcome', 'experience']) {
      await page.goto(`${route}/`)
      await expect.poll(() => page.getByRole('img', { name: 'Photobooth', exact: true }).first()
        .evaluate((node: HTMLImageElement) => /photobooth-logo-(160|320)\.webp/.test(node.currentSrc) && node.complete && node.naturalWidth > 0)).toBe(true)
      const images = page.locator('picture img[src*="/images/demo/"]')
      expect(await images.count()).toBeGreaterThan(20)
      // Native lazy loading must still work inside BrandPage's own scroller.
      for (const image of await images.all()) {
        if (!await image.isVisible()) continue
        await image.scrollIntoViewIfNeeded()
        await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
        expect(await image.evaluate((node: HTMLImageElement) => node.currentSrc.includes('/photobooth/images/demo/'))).toBe(true)
        const density = await image.evaluate((node: HTMLImageElement) => {
          const sources = node.parentElement!.querySelector('source')!.srcset.split(', ').map((entry) => {
            const [url, width] = entry.split(' ')
            return { url: new URL(url, location.href).href, width: Number.parseInt(width) }
          })
          return {
            selected: sources.find((source) => source.url === node.currentSrc)!.width,
            required: Math.min(sources.at(-1)!.width, node.clientWidth * devicePixelRatio * 0.85),
          }
        })
        expect(density.selected).toBeGreaterThanOrEqual(density.required)
      }
      if (route === 'welcome') {
        const hero = page.locator('.hero-collage img[src*="/images/demo/"]')
        expect(await hero.count()).toBe(14)
        expect(await hero.evaluateAll((nodes) => nodes.every((node) => (node as HTMLImageElement).loading === 'eager'))).toBe(true)
        expect(await page.locator('#trai-nghiem img[src*="/images/demo/"]').evaluateAll((nodes) => nodes.every((node) => (node as HTMLImageElement).loading === 'lazy'))).toBe(true)
      } else await expect(page.getByRole('radio')).toHaveCount(5)
    }
    expect(failures).toEqual([])
    await context.close()
  })
}

test('critical font preloads stay selective while all Vietnamese interface weights remain available', async ({ page }) => {
  await page.goto('experience/')
  expect(await page.locator('link[rel="preload"][as="font"]').count()).toBeLessThanOrEqual(5)
  const weights = await page.evaluate(async () => {
    const samples = ['400', '500', '600', '700'].map((weight) => {
      const span = document.createElement('span')
      span.style.fontWeight = weight
      span.textContent = 'Tiếng Việt: Ễ Ứ ợ đ ă â ê ô ơ ư'
      document.body.append(span)
      return span
    })
    await document.fonts.ready
    const faces = [...document.fonts].filter((face) => face.family.replaceAll('"', '') === 'Be Vietnam Pro' && face.status === 'loaded').map((face) => face.weight)
    samples.forEach((sample) => sample.remove())
    return faces
  })
  expect(new Set(weights)).toEqual(new Set(['400', '500', '600', '700']))
  // A valid custom-property value is essential: an unquoted family containing
  // a number can invalidate font-family and silently inherit the body font.
  const client = await page.context().newCDPSession(page)
  await client.send('DOM.enable')
  await client.send('CSS.enable')
  const { root } = await client.send('DOM.getDocument')
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#experience-title > span' })
  const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(fonts.some((font) => font.familyName === 'Baloo 2' && font.isCustomFont)).toBe(true)
  await client.detach()
})

test('mobile avoids the visually hidden handwriting font and keeps the strip label in Newsreader', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('experience/')
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => [...document.fonts].some((face) => face.family.includes('Patrick') && face.status === 'loaded'))).toBe(false)
  await page.goto('welcome/')
  await page.evaluate(() => document.fonts.ready)
  const client = await context.newCDPSession(page)
  await client.send('DOM.enable')
  await client.send('CSS.enable')
  const { root } = await client.send('DOM.getDocument')
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.hero-strip-center p' })
  const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(fonts.some((font) => font.familyName.includes('Newsreader') && font.isCustomFont)).toBe(true)
  await client.detach()
  await context.close()
})
