// Looks are applied after capture: photos are stored untouched and the same
// operation list drives the CSS preview, canvas `filter` and a pixel fallback
// for browsers whose canvas has no `filter` support (older Safari).

export type PhotoboothLookId = 'clean' | 'warm' | 'mono' | 'dreamy' | 'flash'

type LookOperation =
  | { type: 'brightness'; amount: number }
  | { type: 'contrast'; amount: number }
  | { type: 'saturate'; amount: number }
  | { type: 'grayscale'; amount: number }
  | { type: 'sepia'; amount: number }
  | { type: 'hue-rotate'; degrees: number }

export type PhotoboothLook = {
  id: PhotoboothLookId
  label: string
  description: string
  operations: LookOperation[]
}

export const PHOTOBOOTH_LOOKS: PhotoboothLook[] = [
  { id: 'clean', label: 'Clean', description: 'Màu gốc, trung thực', operations: [] },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Ấm áp như nắng chiều',
    operations: [
      { type: 'sepia', amount: 0.22 },
      { type: 'saturate', amount: 1.15 },
      { type: 'brightness', amount: 1.04 },
    ],
  },
  {
    id: 'mono',
    label: 'Mono',
    description: 'Đen trắng tương phản',
    operations: [
      { type: 'grayscale', amount: 1 },
      { type: 'contrast', amount: 1.12 },
    ],
  },
  {
    id: 'dreamy',
    label: 'Dreamy',
    description: 'Mềm, sáng và nhẹ',
    operations: [
      { type: 'brightness', amount: 1.08 },
      { type: 'contrast', amount: 0.88 },
      { type: 'saturate', amount: 0.85 },
      { type: 'hue-rotate', degrees: -6 },
    ],
  },
  {
    id: 'flash',
    label: 'Flash',
    description: 'Rực rỡ như đèn flash',
    operations: [
      { type: 'brightness', amount: 1.1 },
      { type: 'contrast', amount: 1.2 },
      { type: 'saturate', amount: 1.12 },
    ],
  },
]

export function isLookId(value: unknown): value is PhotoboothLookId {
  return PHOTOBOOTH_LOOKS.some((look) => look.id === value)
}

export function getLook(id: PhotoboothLookId): PhotoboothLook {
  return PHOTOBOOTH_LOOKS.find((look) => look.id === id) ?? PHOTOBOOTH_LOOKS[0]
}

export function toCssFilter(look: PhotoboothLook): string {
  if (look.operations.length === 0) return 'none'

  return look.operations
    .map((operation) =>
      operation.type === 'hue-rotate'
        ? `hue-rotate(${operation.degrees}deg)`
        : `${operation.type}(${operation.amount})`
    )
    .join(' ')
}

type Matrix3 = [number, number, number, number, number, number, number, number, number]

// Color matrices from the Filter Effects spec, matching the CSS shorthand functions.
function operationMatrix(operation: LookOperation): Matrix3 | null {
  switch (operation.type) {
    case 'grayscale': {
      const a = 1 - Math.min(1, Math.max(0, operation.amount))
      return [
        0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
      ]
    }
    case 'sepia': {
      const a = 1 - Math.min(1, Math.max(0, operation.amount))
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
      ]
    }
    case 'saturate': {
      const s = Math.max(0, operation.amount)
      return [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ]
    }
    case 'hue-rotate': {
      const radians = (operation.degrees * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      return [
        0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
      ]
    }
    default:
      return null
  }
}

function clampByte(value: number) {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

/** Applies a look to RGBA pixels in place; each operation clamps like a CSS filter chain. */
export function applyLookToPixels(data: Uint8ClampedArray, look: PhotoboothLook) {
  for (const operation of look.operations) {
    const matrix = operationMatrix(operation)

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      if (matrix) {
        data[i] = clampByte(matrix[0] * r + matrix[1] * g + matrix[2] * b)
        data[i + 1] = clampByte(matrix[3] * r + matrix[4] * g + matrix[5] * b)
        data[i + 2] = clampByte(matrix[6] * r + matrix[7] * g + matrix[8] * b)
      } else if (operation.type === 'brightness') {
        data[i] = clampByte(r * operation.amount)
        data[i + 1] = clampByte(g * operation.amount)
        data[i + 2] = clampByte(b * operation.amount)
      } else if (operation.type === 'contrast') {
        const offset = 127.5 * (1 - operation.amount)
        data[i] = clampByte(r * operation.amount + offset)
        data[i + 1] = clampByte(g * operation.amount + offset)
        data[i + 2] = clampByte(b * operation.amount + offset)
      }
    }
  }
}
