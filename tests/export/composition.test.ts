import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { PHOTOBOOTH_FRAMES, buildFrameSvg, formatFrameDate } from '@/src/features/photobooth/domain/frames'
import {
  PHOTOBOOTH_LAYOUT_IDS,
  PRINT_CAPTION_TOP,
  PRINT_WIDTH,
  computeCoverCrop,
  getCompatibleLayouts,
  getLayout,
} from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, applyLookToPixels, getLook, toCssFilter } from '@/src/features/photobooth/domain/looks'

describe('layouts', () => {
  for (const id of PHOTOBOOTH_LAYOUT_IDS) {
    const layout = getLayout(id)

    test(`${id}: slots stay inside the print and never overlap`, () => {
      for (const slot of layout.slots) {
        assert.ok(slot.x >= 0 && slot.x + slot.width <= PRINT_WIDTH)
        assert.ok(slot.y >= 0 && slot.y + slot.height <= PRINT_CAPTION_TOP)
      }
      for (const a of layout.slots) {
        for (const b of layout.slots) {
          if (a === b) continue
          const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
          assert.equal(overlap, false)
        }
      }
    })

    test(`${id}: prints every shot, in order`, () => {
      const shown = [...new Set(layout.slots.map((slot) => slot.shotIndex))].sort((a, b) => a - b)
      assert.deepEqual(shown, Array.from({ length: layout.shotCount }, (_, index) => index))
      const firstAppearance = layout.slots.map((slot) => slot.shotIndex).filter((value, index, list) => list.indexOf(value) === index)
      assert.deepEqual(firstAppearance, shown)
      assert.equal(layout.repeatsShots, layout.slots.length > layout.shotCount)
    })
  }

  test('compatible layouts keep the shot count', () => {
    assert.deepEqual(getCompatibleLayouts(4).map((layout) => layout.id), ['grid-4', 'vertical-4'])
    assert.deepEqual(getCompatibleLayouts(6).map((layout) => layout.id), ['grid-6'])
  })
})

describe('computeCoverCrop', () => {
  test('landscape photo into portrait slot crops the sides, centered', () => {
    const crop = computeCoverCrop(1920, 1080, 477, 650)
    assert.equal(crop.sh, 1080)
    assert.ok(Math.abs(crop.sw / crop.sh - 477 / 650) < 1e-9)
    assert.ok(Math.abs(crop.sx - (1920 - crop.sw) / 2) < 1e-9)
    assert.equal(crop.sy, 0)
  })

  test('portrait photo into landscape slot crops top and bottom, centered', () => {
    const crop = computeCoverCrop(1080, 1920, 477, 320)
    assert.equal(crop.sw, 1080)
    assert.ok(Math.abs(crop.sw / crop.sh - 477 / 320) < 1e-9)
    assert.ok(Math.abs(crop.sy - (1920 - crop.sh) / 2) < 1e-9)
  })
})

describe('frames', () => {
  test('none draws no overlay', () => {
    for (const id of PHOTOBOOTH_LAYOUT_IDS) assert.equal(buildFrameSvg(getLayout(id), 'none', '01.01.2026'), null)
  })

  test('every frame cuts a window for every slot of every layout', () => {
    for (const frame of PHOTOBOOTH_FRAMES.filter((item) => item.id !== 'none')) {
      for (const id of PHOTOBOOTH_LAYOUT_IDS) {
        const layout = getLayout(id)
        const svg = buildFrameSvg(layout, frame.id, '01.01.2026') ?? ''
        for (const slot of layout.slots) {
          assert.ok(svg.includes(`M${slot.x} ${slot.y}h${slot.width}v${slot.height}`), `${frame.id}/${id}`)
        }
        assert.ok(svg.includes('fill-rule="evenodd"'))
      }
    }
  })

  test('date label is escaped and formatted', () => {
    const svg = buildFrameSvg(getLayout('grid-4'), 'minimal', '<b>&') ?? ''
    assert.ok(svg.includes('&lt;b&gt;&amp;'))
    assert.equal(formatFrameDate(new Date(2026, 9, 2).getTime()), '02.10.2026')
  })
})

describe('looks', () => {
  test('clean is a no-op', () => {
    const pixels = new Uint8ClampedArray([10, 120, 250, 255])
    applyLookToPixels(pixels, getLook('clean'))
    assert.deepEqual([...pixels], [10, 120, 250, 255])
    assert.equal(toCssFilter(getLook('clean')), 'none')
  })

  test('mono produces neutral gray and keeps alpha', () => {
    const pixels = new Uint8ClampedArray([200, 40, 90, 128])
    applyLookToPixels(pixels, getLook('mono'))
    assert.equal(pixels[0], pixels[1])
    assert.equal(pixels[1], pixels[2])
    assert.equal(pixels[3], 128)
  })

  test('css string mirrors the operation list', () => {
    assert.equal(toCssFilter(getLook('mono')), 'grayscale(1) contrast(1.12)')
    assert.equal(toCssFilter(getLook('dreamy')), 'brightness(1.08) contrast(0.88) saturate(0.85) hue-rotate(-6deg)')
    for (const look of PHOTOBOOTH_LOOKS) assert.ok(!toCssFilter(look).includes('undefined'))
  })
})
