import { constants } from 'node:fs'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const inputs = join(root, 'design-inputs')
const collections = JSON.parse(await readFile(join(root, 'scripts/demo-collections.json'), 'utf8'))
const { values } = parseArgs({ options: {
  'import-from': { type: 'string' },
  'output-dir': { type: 'string' },
  only: { type: 'string' },
} })
const outputRoot = values['output-dir'] ? resolve(values['output-dir']) : join(root, 'public/images/demo')
const selected = values.only ? new Set(values.only.split(',')) : null
const photoName = (index) => String(index + 1).padStart(2, '0')
const knownPhotos = new Set(collections.flatMap((collection) => collection.corners.map((_, index) => `${collection.id}/${photoName(index)}`)))
for (const name of selected ?? []) {
  if (!knownPhotos.has(name)) throw new Error(`Unknown demo photo: ${name}`)
}
const neededCollections = collections.filter((collection) => !selected || collection.corners.some((_, index) => selected.has(`${collection.id}/${photoName(index)}`)))

// Optional import copies originals exclusively: a resumed run never replaces them.
if (values['import-from']) {
  await mkdir(inputs, { recursive: true })
  for (const collection of neededCollections) {
    try {
      await copyFile(join(resolve(values['import-from']), collection.originalName), join(inputs, collection.source), constants.COPYFILE_EXCL)
    } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'ENOENT') throw error
    }
  }
}

const missing = []
for (const collection of neededCollections) {
  try {
    await readFile(join(inputs, collection.source))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    missing.push(`${collection.source} (${collection.originalName})`)
  }
}
if (missing.length) throw new Error(`Missing original images:\n${missing.join('\n')}`)

/** Map a unit square into the four photo corners, correcting the printed sheet's perspective. */
function projection([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / determinant
  const h = (dx1 * dy3 - dx3 * dy1) / determinant
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h]
}

function extractPhoto(data, info, corners, width, height) {
  const [a, b, c, d, e, f, g, h] = projection(corners)
  const output = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1)
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1)
      const divisor = g * u + h * v + 1
      const sx = Math.max(0, Math.min(info.width - 2, (a * u + b * v + c) / divisor))
      const sy = Math.max(0, Math.min(info.height - 2, (d * u + e * v + f) / divisor))
      const ix = Math.floor(sx)
      const iy = Math.floor(sy)
      const fx = sx - ix
      const fy = sy - iy
      const offset = (iy * info.width + ix) * 3
      for (let channel = 0; channel < 3; channel += 1) {
        const top = data[offset + channel] * (1 - fx) + data[offset + 3 + channel] * fx
        const bottom = data[offset + info.width * 3 + channel] * (1 - fx) + data[offset + info.width * 3 + 3 + channel] * fx
        output[(y * width + x) * 3 + channel] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  return output
}

let total = 0
let bytes = 0
for (const collection of neededCollections) {
  const source = await readFile(join(inputs, collection.source))
  if (createHash('sha256').update(source).digest('hex') !== collection.sourceSha256) {
    throw new Error(`Source checksum mismatch: ${collection.source}`)
  }
  const { data, info } = await sharp(source).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  if (info.width !== collection.sourceSize[0] || info.height !== collection.sourceSize[1]) {
    throw new Error(`Unexpected source dimensions: ${collection.source}`)
  }
  const outputDirectory = join(outputRoot, collection.id)
  await mkdir(outputDirectory, { recursive: true })
  for (const [index, corners] of collection.corners.entries()) {
    if (selected && !selected.has(`${collection.id}/${photoName(index)}`)) continue
    const [width, height] = collection.photoSizes?.[index] ?? collection.photoSize
    const pixels = extractPhoto(data, info, corners, width, height)
    let image = sharp(pixels, { raw: { width, height, channels: 3 } })
    const trim = collection.trims?.[index]
    if (trim) {
      const [left, top, right, bottom] = trim
      image = image.extract({ left, top, width: width - left - right, height: height - top - bottom })
    }
    const encoded = await image.webp({ quality: 86, effort: 6 }).toBuffer()
    const path = join(outputDirectory, `${photoName(index)}.webp`)
    // Existing files must match exactly; differing work is left intact for review.
    try {
      await writeFile(path, encoded, { flag: 'wx' })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (!(await readFile(path)).equals(encoded)) throw new Error(`Refusing to overwrite existing asset: ${path}`)
    }
    total += 1
    bytes += encoded.length
  }
  console.log(`${collection.id}: processed selected photos`)
}
console.log(`${total} photos, ${(bytes / 1024).toFixed(1)} KiB total`)
