import { getFrame, getFrameOverlayUrl, type PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import {
  PRINT_HEIGHT,
  PRINT_WIDTH,
  planSlotDraws,
  type PhotoboothLayout,
} from '@/src/features/photobooth/domain/layouts'
import { applyLookToPixels, getLook, toCssFilter, type PhotoboothLookId } from '@/src/features/photobooth/domain/looks'
import { loadPhoto } from '@/src/features/photobooth/services/storage/photoStore'

/** 1.5× the design size: 1800×2349 px, enough for a 4×6" print at ~390 dpi. */
const EXPORT_SCALE = 1.5

type DrawableImage = { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decodeBlob(blob: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = src
  })
}

let canvasFilterSupport: boolean | null = null

/** Safari before canvas-filter support ignores `ctx.filter`; fall back to pixel math there. */
function supportsCanvasFilter() {
  if (canvasFilterSupport === null) {
    const context = document.createElement('canvas').getContext('2d')
    if (context && 'filter' in context) {
      context.filter = 'grayscale(1)'
      canvasFilterSupport = context.filter === 'grayscale(1)'
    } else {
      canvasFilterSupport = false
    }
  }
  return canvasFilterSupport
}

/**
 * Renders the print exactly like PhotoComposition: same slots, centered cover
 * crop, look and frame overlay, scaled from the shared layout geometry.
 */
export async function renderCompositionPng({
  layout,
  frameId,
  lookId,
  shots,
  dateLabel,
}: {
  layout: PhotoboothLayout
  frameId: PhotoboothFrameId
  lookId: PhotoboothLookId
  /** Photo ids by shot index; every shot of the layout must be present. */
  shots: ReadonlyArray<string | null>
  dateLabel: string
}): Promise<Blob> {
  // Index by shot, never compact the list: a gap would shift every later photo into the wrong slot.
  if (shots.length !== layout.shotCount || shots.some((id) => id === null)) throw new Error('PHOTO_MISSING')
  const blobs = await Promise.all(shots.map((id) => loadPhoto(id as string)))
  if (blobs.some((blob) => blob === null)) throw new Error('PHOTO_MISSING')

  const decoded = await Promise.allSettled((blobs as Blob[]).map(decodeBlob))
  const images = decoded.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  if (images.length !== decoded.length) {
    images.forEach((image) => image.close())
    throw new Error('PHOTO_DECODE_FAILED')
  }

  const canvas = document.createElement('canvas')
  try {
    canvas.width = Math.round(PRINT_WIDTH * EXPORT_SCALE)
    canvas.height = Math.round(PRINT_HEIGHT * EXPORT_SCALE)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('CANVAS_UNAVAILABLE')

    context.fillStyle = getFrame(frameId).paper
    context.fillRect(0, 0, canvas.width, canvas.height)

    const look = getLook(lookId)
    const useCanvasFilter = supportsCanvasFilter()

    for (const { shotIndex, crop, dest } of planSlotDraws(layout, images, EXPORT_SCALE)) {
      const image = images[shotIndex]
      const { x, y, width, height } = dest

      context.save()
      context.filter = useCanvasFilter ? toCssFilter(look) : 'none'
      context.drawImage(image.source, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height)
      context.restore()

      if (!useCanvasFilter && look.operations.length > 0) {
        const pixels = context.getImageData(x, y, width, height)
        applyLookToPixels(pixels.data, look)
        context.putImageData(pixels, x, y)
      }
    }

    const overlayUrl = getFrameOverlayUrl(layout, frameId, dateLabel)
    if (overlayUrl) {
      const overlay = await loadImage(overlayUrl)
      context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
    }

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('EXPORT_ENCODE_FAILED')
    return png
  } finally {
    images.forEach((image) => image.close())
    // iOS caps total canvas memory; a zero-sized canvas releases its backing store at once.
    canvas.width = 0
    canvas.height = 0
  }
}

/** photobooth-YYYYMMDD-HHmmss.png in local time. */
export function buildExportFileName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `photobooth-${day}-${time}.png`
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers read the URL after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
