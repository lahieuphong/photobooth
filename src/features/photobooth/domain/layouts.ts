// Single source of truth for print geometry. Preview (CSS percentages), frame
// artwork (SVG holes) and PNG export (canvas pixels) are all derived from these
// slots, so they cannot drift apart.

export type PhotoboothLayoutId = 'grid-4' | 'vertical-4' | 'grid-6'

export type PhotoboothLayoutSlot = {
  x: number
  y: number
  width: number
  height: number
  /** Which captured shot is shown in this slot. */
  shotIndex: number
}

export type PhotoboothLayout = {
  id: PhotoboothLayoutId
  label: string
  description: string
  shotCount: number
  /** True when every shot is printed more than once (e.g. twin strips). */
  repeatsShots: boolean
  slots: PhotoboothLayoutSlot[]
}

/** Print canvas in design units (portrait 4x6-ish card). */
export const PRINT_WIDTH = 1200
export const PRINT_HEIGHT = 1566
/** Everything below this line is caption space reserved for frame artwork. */
export const PRINT_CAPTION_TOP = 1450

function buildGrid({
  columns,
  rows,
  width,
  height,
  shotIndexFor,
}: {
  columns: number[]
  rows: number[]
  width: number
  height: number
  shotIndexFor: (row: number, column: number) => number
}): PhotoboothLayoutSlot[] {
  return rows.flatMap((y, row) =>
    columns.map((x, column) => ({ x, y, width, height, shotIndex: shotIndexFor(row, column) }))
  )
}

export const PHOTOBOOTH_LAYOUTS: Record<PhotoboothLayoutId, PhotoboothLayout> = {
  'grid-4': {
    id: 'grid-4',
    label: 'Lưới 2×2',
    description: '4 ảnh lớn, cân đối',
    shotCount: 4,
    repeatsShots: false,
    slots: buildGrid({
      columns: [90, 633],
      rows: [88, 800],
      width: 477,
      height: 650,
      shotIndexFor: (row, column) => row * 2 + column,
    }),
  },
  'vertical-4': {
    id: 'vertical-4',
    label: 'Dải dọc ×2',
    description: 'Hai dải giống nhau, cắt đôi để chia sẻ',
    shotCount: 4,
    repeatsShots: true,
    slots: buildGrid({
      columns: [61, 662],
      rows: [88, 435, 782, 1129],
      width: 477,
      height: 320,
      shotIndexFor: (row) => row,
    }),
  },
  'grid-6': {
    id: 'grid-6',
    label: 'Lưới 2×3',
    description: '6 ảnh kể một câu chuyện',
    shotCount: 6,
    repeatsShots: false,
    slots: buildGrid({
      columns: [92, 633],
      rows: [88, 554, 1020],
      width: 475,
      height: 430,
      shotIndexFor: (row, column) => row * 2 + column,
    }),
  },
}

export const PHOTOBOOTH_LAYOUT_IDS = Object.keys(PHOTOBOOTH_LAYOUTS) as PhotoboothLayoutId[]

export function isLayoutId(value: unknown): value is PhotoboothLayoutId {
  return typeof value === 'string' && value in PHOTOBOOTH_LAYOUTS
}

export function getLayout(id: PhotoboothLayoutId): PhotoboothLayout {
  return PHOTOBOOTH_LAYOUTS[id]
}

/** Layouts that print exactly the shots a session has, without dropping or inventing any. */
export function getCompatibleLayouts(shotCount: number): PhotoboothLayout[] {
  return PHOTOBOOTH_LAYOUT_IDS.map(getLayout).filter((layout) => layout.shotCount === shotCount)
}

export type CoverCrop = { sx: number; sy: number; sw: number; sh: number }

/** Centered "object-fit: cover" crop, identical to how the preview renders slots. */
export function computeCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): CoverCrop {
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight

  if (sourceRatio > targetRatio) {
    const sw = sourceHeight * targetRatio
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight }
  }

  const sh = sourceWidth / targetRatio
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh }
}
