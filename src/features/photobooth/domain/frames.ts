import {
  PRINT_CAPTION_TOP,
  PRINT_HEIGHT,
  PRINT_WIDTH,
  type PhotoboothLayout,
} from '@/src/features/photobooth/domain/layouts'
import { createBoundedCache } from '@/src/features/photobooth/utils/boundedCache'
import { pad } from '@/src/features/photobooth/utils/format'

// Frame artwork is generated from the layout slots instead of shipped as one SVG
// per layout, so photo windows always match the preview and export geometry.

export type PhotoboothFrameId = 'none' | 'minimal' | 'editorial' | 'play'

export type PhotoboothFrame = {
  id: PhotoboothFrameId
  label: string
  description: string
  /** Paper color behind the photos; also the only background when there is no frame. */
  paper: string
}

export const PHOTOBOOTH_FRAMES: PhotoboothFrame[] = [
  { id: 'none', label: 'Không khung', description: 'Chỉ ảnh trên nền trắng', paper: '#FFFFFF' },
  { id: 'minimal', label: 'Minimal', description: 'Viền mảnh, chữ ký nhỏ', paper: '#FFFFFF' },
  { id: 'editorial', label: 'Editorial', description: 'Nền than, chữ kiểu tạp chí', paper: '#151413' },
  { id: 'play', label: 'Play', description: 'Viền trắng và confetti', paper: '#FFF1E6' },
]

export function isFrameId(value: unknown): value is PhotoboothFrameId {
  return PHOTOBOOTH_FRAMES.some((frame) => frame.id === value)
}

export function getFrame(id: PhotoboothFrameId): PhotoboothFrame {
  return PHOTOBOOTH_FRAMES.find((frame) => frame.id === id) ?? PHOTOBOOTH_FRAMES[0]
}

const SANS = "'Helvetica Neue', Arial, sans-serif"
const SERIF = "'Times New Roman', Georgia, serif"
const ROUNDED = "'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif"

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sparkle(cx: number, cy: number, r: number, fill: string) {
  const k = r * 0.28
  return (
    `<path d="M${cx} ${cy - r}C${cx + k * 0.4} ${cy - k} ${cx + k} ${cy - k * 0.4} ${cx + r} ${cy}` +
    `C${cx + k} ${cy + k * 0.4} ${cx + k * 0.4} ${cy + k} ${cx} ${cy + r}` +
    `C${cx - k * 0.4} ${cy + k} ${cx - k} ${cy + k * 0.4} ${cx - r} ${cy}` +
    `C${cx - k} ${cy - k * 0.4} ${cx - k * 0.4} ${cy - k} ${cx} ${cy - r}Z" fill="${fill}"/>`
  )
}

function slotOutlines(layout: PhotoboothLayout, inset: number, stroke: string, strokeWidth: number) {
  const offset = inset + strokeWidth / 2
  return layout.slots
    .map(
      (slot) =>
        `<rect x="${slot.x - offset}" y="${slot.y - offset}" width="${slot.width + offset * 2}" ` +
        `height="${slot.height + offset * 2}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    )
    .join('')
}

function decorations(frameId: Exclude<PhotoboothFrameId, 'none'>, layout: PhotoboothLayout, dateLabel: string) {
  const margin = Math.min(...layout.slots.map((slot) => slot.x))
  const right = PRINT_WIDTH - margin
  const captionY = PRINT_CAPTION_TOP + 66
  const date = escapeXml(dateLabel)

  if (frameId === 'minimal') {
    return [
      slotOutlines(layout, 0, '#E6E0D6', 2),
      `<text x="${margin}" y="${captionY}" font-family="${SANS}" font-size="24" letter-spacing="10" fill="#8A847B">PHOTOBOOTH</text>`,
      `<circle cx="600" cy="${captionY - 8}" r="6" fill="#D04B67"/>`,
      `<text x="${right}" y="${captionY}" text-anchor="end" font-family="${SANS}" font-size="24" letter-spacing="4" fill="#8A847B">${date}</text>`,
    ].join('')
  }

  if (frameId === 'editorial') {
    return [
      `<text x="${margin}" y="58" font-family="${SANS}" font-size="20" letter-spacing="9" fill="#EDE6DA">PHOTOBOOTH</text>`,
      `<text x="${right}" y="58" text-anchor="end" font-family="${SANS}" font-size="20" letter-spacing="4" fill="#EDE6DA">${date}</text>`,
      `<path d="M${margin} ${captionY - 20}H430M770 ${captionY - 20}H${right}" stroke="#5C5650" stroke-width="2"/>`,
      `<circle cx="${margin}" cy="${captionY - 20}" r="6" fill="#D04B67"/>`,
      `<text x="600" y="${captionY}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="60" fill="#F4EEE4">Photobooth</text>`,
    ].join('')
  }

  return [
    slotOutlines(layout, 0, '#FFFFFF', 12),
    sparkle(margin - 30, 46, 22, '#D04B67'),
    `<circle cx="${margin + 40}" cy="34" r="8" fill="#F6B53D"/>`,
    `<circle cx="420" cy="48" r="6" fill="#6FB3B8"/>`,
    `<circle cx="780" cy="38" r="7" fill="#F28FB0"/>`,
    `<circle cx="${right - 40}" cy="40" r="8" fill="#6FB3B8"/>`,
    sparkle(right + 28, 52, 18, '#F6B53D'),
    `<circle cx="300" cy="${captionY - 14}" r="9" fill="#F6B53D"/>`,
    `<circle cx="340" cy="${captionY - 30}" r="6" fill="#F28FB0"/>`,
    `<circle cx="860" cy="${captionY - 12}" r="9" fill="#6FB3B8"/>`,
    `<circle cx="900" cy="${captionY - 32}" r="6" fill="#D04B67"/>`,
    sparkle(margin, captionY - 18, 20, '#D04B67'),
    sparkle(right, captionY - 18, 20, '#F6B53D'),
    `<text x="600" y="${captionY}" text-anchor="middle" font-family="${ROUNDED}" font-size="44" font-weight="700" letter-spacing="6" fill="#2B2622">PHOTOBOOTH</text>`,
  ].join('')
}

/** Overlay SVG with transparent windows for every slot, or null when no frame is drawn. */
export function buildFrameSvg(layout: PhotoboothLayout, frameId: PhotoboothFrameId, dateLabel: string) {
  if (frameId === 'none') return null

  const frame = getFrame(frameId)
  const holes = layout.slots
    .map((slot) => `M${slot.x} ${slot.y}h${slot.width}v${slot.height}h${-slot.width}Z`)
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_WIDTH}" height="${PRINT_HEIGHT}" ` +
    `viewBox="0 0 ${PRINT_WIDTH} ${PRINT_HEIGHT}">` +
    `<path fill-rule="evenodd" fill="${frame.paper}" d="M0 0H${PRINT_WIDTH}V${PRINT_HEIGHT}H0Z${holes}"/>` +
    decorations(frameId, layout, dateLabel) +
    `</svg>`
  )
}

const frameUrlCache = createBoundedCache<string, string | null>(64)

export function getFrameOverlayUrl(layout: PhotoboothLayout, frameId: PhotoboothFrameId, dateLabel: string) {
  const key = `${layout.id}|${frameId}|${dateLabel}`

  const cached = frameUrlCache.get(key)
  if (cached !== undefined) return cached

  const svg = buildFrameSvg(layout, frameId, dateLabel)
  const url = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null
  frameUrlCache.set(key, url)
  return url
}

/** "22.10.2026" style label printed on frames; derived from the session start time. */
export function formatFrameDate(timestamp: number) {
  const date = new Date(timestamp)
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}
