import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import sharp from 'sharp'
import { PHOTOBOOTH_EXPERIENCES } from '@/src/features/photobooth/config/experiences'
import { getDemoPhotoSrcSets, getDemoPhotoUrls } from '@/src/features/photobooth/config/demoPhotos'

test('all 22 responsive demo sources exist, declare their real width and preserve the uncropped master', async () => {
  let photos = 0
  for (const experience of PHOTOBOOTH_EXPERIENCES) {
    const originals = getDemoPhotoUrls(experience.id)
    const sources = getDemoPhotoSrcSets(experience.id)
    assert.equal(sources.length, experience.shotCount)
    for (const [index, sourceSet] of sources.entries()) {
      const masterPath = originals[index].replace(/^.*\/images\//, 'public/images/')
      const master = await sharp(masterPath).metadata()
      const candidates = sourceSet.split(', ')
      assert.equal(candidates.at(-1), `${originals[index]} ${master.width}w`)
      let previousWidth = 0
      for (const candidate of candidates) {
        const [url, descriptor] = candidate.split(' ')
        const data = await readFile(url.replace(/^.*\/images\//, 'public/images/'))
        const metadata = await sharp(data).metadata()
        assert.equal(descriptor, `${metadata.width}w`)
        assert.ok(metadata.width! > previousWidth)
        previousWidth = metadata.width!
        assert.ok(Math.abs(metadata.height! - master.height! * metadata.width! / master.width!) <= 1)
        if (url !== originals[index]) {
          const reference = await sharp(masterPath).resize({ width: metadata.width }).raw().toBuffer()
          const pixels = await sharp(data).raw().toBuffer()
          assert.equal(pixels.length, reference.length)
          const error = pixels.reduce((total, value, pixel) => total + Math.abs(value - reference[pixel]), 0) / pixels.length
          assert.ok(error < 8, `${url}: mean pixel error ${error}`)
        }
      }
      photos += 1
    }
  }
  assert.equal(photos, 22)
})

test('responsive logos preserve the master artwork with lossless encoding', async () => {
  const master = 'public/images/logos/photobooth-logo.png'
  for (const width of [160, 320]) {
    const image = `public/images/logos/photobooth-logo-${width}.webp`
    const metadata = await sharp(image).metadata()
    assert.equal(metadata.width, width)
    const expected = await sharp(master).resize({ width }).ensureAlpha().raw().toBuffer()
    const actual = await sharp(image).ensureAlpha().raw().toBuffer()
    assert.equal(actual.length, expected.length)
    for (let index = 0; index < actual.length; index += 4) {
      assert.equal(actual[index + 3], expected[index + 3])
      if (expected[index + 3] === 0) continue
      for (let channel = 0; channel < 3; channel += 1) assert.equal(actual[index + channel], expected[index + channel])
    }
  }
})
