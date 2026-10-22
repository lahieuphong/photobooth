import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_KIOSK_IDLE_MINUTES,
  getKioskSettings,
  getOrphanCutoffMs,
  parseKioskValue,
  toKioskSettings,
} from '@/src/features/photobooth/config/kiosk'
import { getIdlePhase } from '@/src/features/photobooth/domain/inactivity'

const MINUTE = 60_000
const settings = { idleTimeoutMs: 15 * MINUTE, warningMs: MINUTE }

describe('idle phases', () => {
  test('active, then a warning for the last minute, then expired', () => {
    const at = (idleMs: number) => getIdlePhase({ now: 100 * MINUTE, lastActivityAt: 100 * MINUTE - idleMs, busy: false, ...settings })

    assert.deepEqual(at(0), { phase: 'active' })
    assert.deepEqual(at(14 * MINUTE - 1), { phase: 'active' })
    assert.deepEqual(at(14 * MINUTE), { phase: 'warning', remainingMs: MINUTE })
    assert.deepEqual(at(15 * MINUTE - 1000), { phase: 'warning', remainingMs: 1000 })
    assert.deepEqual(at(15 * MINUTE), { phase: 'expired' })
  })

  test('running work (capture, export) is never treated as idle', () => {
    assert.deepEqual(getIdlePhase({ now: 100 * MINUTE, lastActivityAt: 0, busy: true, ...settings }), { phase: 'active' })
  })

  test('a clock that jumps backwards does not break the timer', () => {
    assert.deepEqual(getIdlePhase({ now: 0, lastActivityAt: 10 * MINUTE, busy: false, ...settings }), { phase: 'active' })
  })
})

describe('kiosk settings', () => {
  test('parses on/off and minutes, clamped to a sane range', () => {
    assert.equal(parseKioskValue('1'), DEFAULT_KIOSK_IDLE_MINUTES)
    assert.equal(parseKioskValue('on'), DEFAULT_KIOSK_IDLE_MINUTES)
    assert.equal(parseKioskValue('off'), 'off')
    assert.equal(parseKioskValue('0'), 'off')
    assert.equal(parseKioskValue('10'), 10)
    assert.equal(parseKioskValue('0.5'), 2)
    assert.equal(parseKioskValue('9999'), 240)
    assert.equal(parseKioskValue('abc'), null)
    assert.equal(parseKioskValue(''), null)
    assert.equal(parseKioskValue(null), null)
  })

  test('the warning never takes more than a third of the timeout', () => {
    assert.deepEqual(toKioskSettings(15), { enabled: true, idleTimeoutMs: 15 * MINUTE, warningMs: MINUTE })
    assert.deepEqual(toKioskSettings(2), { enabled: true, idleTimeoutMs: 2 * MINUTE, warningMs: 40_000 })
    assert.deepEqual(toKioskSettings('off'), { enabled: false })
    assert.deepEqual(toKioskSettings(null), { enabled: false })
  })

  test('off by default: personal devices keep photos for a day of inactivity', () => {
    assert.deepEqual(getKioskSettings(), { enabled: false })
    assert.equal(getOrphanCutoffMs(), 24 * 60 * MINUTE)
  })
})
