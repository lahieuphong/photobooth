import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'public/images/logos/photobooth-logo.png')
const output = join(root, 'public/pwa-icons')

// Reuse the original RGBA artwork. An opaque canvas would put a square behind
// the logo on a browser tab, especially when the browser uses a colored theme.
function icon(size) {
  return sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

await mkdir(output, { recursive: true })
for (const size of [192, 512]) {
  await writeFile(join(output, `icon-${size}-transparent.png`), await icon(size))
}

// ICO supports PNG payloads; preserve alpha in every tab-size fallback frame.
const sizes = [16, 32, 48]
const frames = await Promise.all(sizes.map(icon))
const header = Buffer.alloc(6 + frames.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(frames.length, 4)
let offset = header.length
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16
  header[entry] = sizes[index]
  header[entry + 1] = sizes[index]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(frame.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += frame.length
}
await writeFile(join(root, 'app/favicon.ico'), Buffer.concat([header, ...frames]))
console.log('Generated transparent 192/512 PNG icons and 16/32/48 ICO frames.')
