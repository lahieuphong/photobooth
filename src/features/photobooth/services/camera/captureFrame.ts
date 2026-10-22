const CAPTURE_MAX_LONG_EDGE = 1920
const CAPTURE_JPEG_QUALITY = 0.9
const RETRY_ATTEMPTS = 8
const RETRY_DELAY_MS = 120

type CaptureOptions = {
  /** Mirror like the on-screen selfie preview so the photo matches what people saw. */
  mirror: boolean
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), type, quality)
  })
}

/** Grabs the current video frame as an unfiltered JPEG; null when no frame is available yet. */
async function captureVideoFrame(video: HTMLVideoElement | null, { mirror }: CaptureOptions) {
  if (!video || video.paused || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null
  }

  // A stopped track keeps showing its last frame; never save that as a new photo.
  const stream = video.srcObject instanceof MediaStream ? video.srcObject : null
  if (!stream || !stream.getVideoTracks().some((track) => track.readyState === 'live')) {
    return null
  }

  const scale = Math.min(1, CAPTURE_MAX_LONG_EDGE / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) return null

  if (mirror) {
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  try {
    return await canvasToBlob(canvas, 'image/jpeg', CAPTURE_JPEG_QUALITY)
  } catch {
    return null
  }
}

/** Some devices report readiness a few frames before the first decodable frame. */
export async function captureVideoFrameWithRetry(video: HTMLVideoElement | null, options: CaptureOptions) {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    const blob = await captureVideoFrame(video, options)
    if (blob) return blob
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return null
}
