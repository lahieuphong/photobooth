import type { Page } from '@playwright/test'

/**
 * Compares the on-screen print with the exported PNG, and inspects the PNG:
 * size, how much of each photo area is actual image (not blank paper), and
 * whether anything is drawn in the caption band (frame artwork lives there).
 */
export async function inspectExport(page: Page, png: Buffer) {
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
