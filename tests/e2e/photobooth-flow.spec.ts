import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { captureSession, decodedBlobImages, expectRoute, readStorage } from './helpers/app'

type Preset = {
  title: string
  shots: number
  studio: { look?: string; frame?: string; layout?: string }
  frameDrawn: boolean
  layouts: number
}

const PRESETS: Preset[] = [
  { title: 'Quick 4', shots: 4, studio: { look: 'Mono', frame: 'Không khung' }, frameDrawn: false, layouts: 2 },
  { title: 'Editorial', shots: 4, studio: {}, frameDrawn: true, layouts: 2 },
  { title: 'Duo', shots: 4, studio: { look: 'Warm', frame: 'Minimal', layout: 'Dải dọc ×2' }, frameDrawn: true, layouts: 2 },
  { title: 'Story 6', shots: 6, studio: {}, frameDrawn: true, layouts: 1 },
  { title: 'Play', shots: 4, studio: { look: 'Dreamy' }, frameDrawn: true, layouts: 2 },
]

/**
 * Compares the on-screen print with the exported PNG, and inspects the PNG:
 * size, how much of each photo area is actual image (not blank paper), and
 * whether anything is drawn in the caption band (frame artwork lives there).
 */
async function inspectExport(page: Page, png: Buffer) {
  const preview = await page.locator('div[style*="aspect-ratio: 1200 / 1566"]').first().screenshot()
  return page.evaluate(
    async ([shownBase64, exportedBase64]) => {
      const load = (data: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = `data:image/png;base64,${data}`
        })
      const [shown, exported] = await Promise.all([load(shownBase64), load(exportedBase64)])

      const width = 240
      const height = Math.round((width * 1566) / 1200)
      const sample = (image: HTMLImageElement) => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0, width, height)
        return context.getImageData(0, 0, width, height).data
      }
      const a = sample(shown)
      const b = sample(exported)
      let diff = 0
      for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])

      const full = document.createElement('canvas')
      full.width = exported.naturalWidth
      full.height = exported.naturalHeight
      const context = full.getContext('2d')!
      context.drawImage(exported, 0, 0)
      const caption = context.getImageData(0, Math.round(1450 * 1.5), full.width, Math.round(116 * 1.5)).data
      let captionArtwork = 0
      for (let i = 0; i < caption.length; i += 4) {
        if (caption[i] !== caption[0] || caption[i + 1] !== caption[1] || caption[i + 2] !== caption[2]) captionArtwork += 1
      }
      // The first slot of every layout starts at (≥61, 88) in design units: its center must hold image, not paper.
      const center = context.getImageData(Math.round(300 * 1.5), Math.round(250 * 1.5), 1, 1).data
      const paper = context.getImageData(2, 2, 1, 1).data
      const photoDiffersFromPaper = Math.abs(center[0] - paper[0]) + Math.abs(center[1] - paper[1]) + Math.abs(center[2] - paper[2]) > 30

      return {
        width: exported.naturalWidth,
        height: exported.naturalHeight,
        meanDiff: diff / (width * height * 3),
        captionArtwork,
        photoDiffersFromPaper,
      }
    },
    [preview.toString('base64'), png.toString('base64')] as const
  )
}

for (const preset of PRESETS) {
  test(`${preset.title}: full flow, PNG export and private restart`, async ({ page }) => {
    const captured = await captureSession(page, preset.title, preset.shots)
    const sessionId = captured.session!.id
    expect(captured.session!.shots.filter(Boolean)).toHaveLength(preset.shots)
    expect(new Set(captured.session!.shots).size).toBe(preset.shots)
    expect(captured.photos.filter((photo) => photo.sessionId === sessionId)).toHaveLength(preset.shots)

    await page.getByRole('button', { name: /Vào Studio/ }).click()
    await expectRoute(page, '/studio')
    await page.getByRole('tab', { name: 'Bố cục' }).click()
    await expect(page.getByRole('radio')).toHaveCount(preset.layouts)
    if (preset.studio.layout) await page.getByRole('radio', { name: new RegExp(preset.studio.layout) }).click()
    if (preset.studio.look) {
      await page.getByRole('tab', { name: 'Look' }).click()
      await page.getByRole('radio', { name: preset.studio.look }).click()
    }
    if (preset.studio.frame) {
      await page.getByRole('tab', { name: 'Khung' }).click()
      await page.getByRole('radio', { name: preset.studio.frame }).click()
    }
    const edited = await readStorage(page)
    expect(edited.session!.shots, 'Studio never touches photos').toEqual(captured.session!.shots)

    await page.getByRole('button', { name: /Hoàn tất/ }).click()
    await expectRoute(page, '/result')
    await expect.poll(() => decodedBlobImages(page)).toBeGreaterThan(0)

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Tải ảnh PNG/ }).click()])
    expect(download.suggestedFilename()).toMatch(/^photobooth-\d{8}-\d{6}\.png$/)
    await expect(page.getByText(/Đã tạo photobooth-.*\.png và chuyển cho trình duyệt tải về/)).toBeVisible()
    const png = await readFile((await download.path())!)
    const result = await inspectExport(page, png)
    expect(result.width).toBe(1800)
    expect(result.height).toBe(2349)
    expect(result.photoDiffersFromPaper, 'export is not blank').toBe(true)
    // Same slots, crop, order and look as the preview (text antialiasing aside).
    expect(result.meanDiff).toBeLessThan(6)
    if (preset.frameDrawn) expect(result.captionArtwork).toBeGreaterThan(0)
    else expect(result.captionArtwork, 'no frame means no overlay at all').toBe(0)

    await page.getByRole('button', { name: /Chụp phiên mới/ }).click()
    await page.getByRole('button', { name: /^Xác nhận/ }).click()
    await expectRoute(page, '/experience')
    await expect(page.getByText(/đã được xóa khỏi bộ nhớ trình duyệt/)).toBeVisible()
    const after = await readStorage(page)
    expect(after.session).toBeNull()
    expect(after.photos.filter((photo) => photo.sessionId === sessionId)).toHaveLength(0)
    expect(after.sessions.find((record) => record.id === sessionId)?.endedAt).not.toBeNull()

    // Privacy: going back to the old result must not show anything.
    await page.goBack()
    await expectRoute(page, '/experience')
  })
}

test('browser back and forward keep the session consistent', async ({ page }) => {
  await captureSession(page, 'Quick 4', 4)
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await expectRoute(page, '/studio')
  await page.goBack()
  await expectRoute(page, '/review')
  await expect.poll(() => decodedBlobImages(page)).toBe(4)
  await page.goForward()
  await expectRoute(page, '/studio')
  await page.goto('result/')
  // Result needs a finished Studio step; the guard sends the session back there.
  await expectRoute(page, '/studio')
})
