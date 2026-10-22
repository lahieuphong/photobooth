import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  classifyCameraError,
  createCameraManager,
  type CameraManagerDeps,
  type CameraPhase,
} from '@/src/features/photobooth/services/camera/cameraStream'

const STARTUP_MS = 12_000
const KEEP_ALIVE_MS = 1500

/** Manual clock: timers only fire when the test advances time. */
function createClock() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    setTimeout: ((callback: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { at: now + ms, callback })
      return id as unknown as ReturnType<typeof setTimeout>
    }) as CameraManagerDeps['setTimeout'],
    clearTimeout: ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number)
    }) as CameraManagerDeps['clearTimeout'],
    advance(ms: number) {
      const target = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        now = due[1].at
        due[1].callback()
      }
      now = target
    },
    pending: () => timers.size,
  }
}

type FakeTrack = { readyState: 'live' | 'ended'; stop(): void; addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void; end(): void }

function createStream() {
  const listeners = new Set<() => void>()
  const track: FakeTrack = {
    readyState: 'live',
    stop() {
      this.readyState = 'ended'
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    /** The device going away (unplugged, permission revoked). */
    end() {
      this.readyState = 'ended'
      listeners.forEach((listener) => listener())
    },
  }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

/** getUserMedia whose calls stay pending until the test settles them. */
function createGetUserMedia() {
  const calls: Array<{ resolve: (stream: MediaStream) => void; reject: (error: unknown) => void; settled: boolean }> = []
  let pending = 0
  let maxPending = 0
  const getUserMedia = () =>
    new Promise<MediaStream>((resolve, reject) => {
      pending += 1
      maxPending = Math.max(maxPending, pending)
      const call = {
        settled: false,
        resolve: (stream: MediaStream) => {
          call.settled = true
          pending -= 1
          resolve(stream)
        },
        reject: (error: unknown) => {
          call.settled = true
          pending -= 1
          reject(error)
        },
      }
      calls.push(call)
    })
  return {
    getUserMedia,
    calls,
    last: () => calls[calls.length - 1],
    stats: () => ({ calls: calls.length, pending, maxPending }),
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

function setup(overrides: Partial<CameraManagerDeps> = {}) {
  const clock = createClock()
  const media = createGetUserMedia()
  const phases: CameraPhase['status'][] = []
  const manager = createCameraManager({
    getUserMedia: media.getUserMedia,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    startupTimeoutMs: STARTUP_MS,
    keepAliveMs: KEEP_ALIVE_MS,
    ...overrides,
  })
  manager.subscribe((phase) => phases.push(phase.status))
  return { clock, media, manager, phases }
}

const domError = (name: string) => Object.assign(new Error(name), { name })

describe('camera startup', () => {
  test('starts and becomes ready', async () => {
    const { media, manager } = setup()
    manager.hold()
    assert.equal(manager.getPhase().status, 'requesting')

    const { stream } = createStream()
    media.last().resolve(stream)
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'ready', stream })
  })

  test('permission denied fails at once, without a looser second request', async () => {
    const { media, manager } = setup()
    manager.hold()
    media.last().reject(domError('NotAllowedError'))
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'failed', kind: 'permission-denied' })
    assert.equal(media.stats().calls, 1)
  })

  test('a busy camera is retried once with loose constraints, sequentially', async () => {
    const { media, manager } = setup()
    manager.hold()
    media.last().reject(domError('NotReadableError'))
    await flush()
    assert.equal(media.stats().calls, 2)
    media.last().reject(domError('NotReadableError'))
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'failed', kind: 'in-use' })
    assert.equal(media.stats().maxPending, 1)
  })

  test('a device that disconnects while live is reported and released', async () => {
    const { media, manager } = setup()
    manager.hold()
    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()

    track.end()
    assert.deepEqual(manager.getPhase(), { status: 'failed', kind: 'disconnected' })
    assert.equal(manager.inspect().hasStream, false)
  })

  test('slow startup that finishes before the budget never shows a timeout', async () => {
    const { clock, media, manager, phases } = setup()
    manager.hold()
    clock.advance(STARTUP_MS - 1)
    media.last().resolve(createStream().stream)
    await flush()
    clock.advance(STARTUP_MS)
    assert.equal(manager.getPhase().status, 'ready')
    assert.ok(!phases.includes('timed-out'))
  })

  test('a request pending past the budget times out but is kept, never duplicated', async () => {
    const { clock, media, manager } = setup()
    manager.hold()
    clock.advance(STARTUP_MS)
    await flush()
    assert.equal(manager.getPhase().status, 'timed-out')
    assert.equal(manager.isPending(), true)

    assert.equal(manager.retry(), false, 'retry is refused while the request is pending')
    manager.hold()
    assert.equal(media.stats().calls, 1)
    assert.equal(media.stats().maxPending, 1)
  })

  test('a late stream after the timeout is used', async () => {
    const { clock, media, manager } = setup()
    manager.hold()
    clock.advance(STARTUP_MS * 3)
    const { stream } = createStream()
    media.last().resolve(stream)
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'ready', stream })
  })

  test('a late failure after the timeout is reported and can then be retried', async () => {
    const { clock, media, manager } = setup()
    manager.hold()
    clock.advance(STARTUP_MS)
    media.last().reject(domError('NotAllowedError'))
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'failed', kind: 'permission-denied' })

    assert.equal(manager.retry(), true)
    assert.equal(manager.getPhase().status, 'requesting')
    assert.equal(media.stats().calls, 2)
  })

  test('an open permission prompt is "waiting for permission", and becomes overdue after two budgets', async () => {
    const { clock, manager } = setup({ queryPermission: async () => 'prompt' })
    manager.hold()
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'waiting-permission', overdue: false })
    clock.advance(STARTUP_MS)
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'waiting-permission', overdue: false })
    clock.advance(STARTUP_MS)
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'waiting-permission', overdue: true })
  })

  test('a prompt answered while the camera itself hangs turns into a timeout', async () => {
    let state: PermissionState = 'prompt'
    const { clock, manager } = setup({ queryPermission: async () => state })
    manager.hold()
    await flush()
    assert.equal(manager.getPhase().status, 'waiting-permission')
    state = 'granted'
    clock.advance(STARTUP_MS)
    await flush()
    assert.equal(manager.getPhase().status, 'timed-out')
  })

  test('time spent hidden does not count: the budget restarts when the page is shown', async () => {
    let hidden = true
    let notify: () => void = () => undefined
    const { clock, manager } = setup({
      isHidden: () => hidden,
      onVisibilityChange: (callback) => {
        notify = callback
        return () => undefined
      },
    })
    manager.hold()
    clock.advance(STARTUP_MS * 5)
    await flush()
    assert.equal(manager.getPhase().status, 'requesting')

    hidden = false
    notify()
    clock.advance(STARTUP_MS - 1)
    await flush()
    assert.equal(manager.getPhase().status, 'requesting', 'a full budget after becoming visible')

    hidden = true
    notify()
    clock.advance(STARTUP_MS * 3)
    await flush()
    assert.equal(manager.getPhase().status, 'requesting', 'paused again while hidden')

    hidden = false
    notify()
    clock.advance(STARTUP_MS)
    await flush()
    assert.equal(manager.getPhase().status, 'timed-out')
  })

  test('without a visibility hook a hidden page is still never timed out', async () => {
    let hidden = true
    const { clock, manager } = setup({ isHidden: () => hidden })
    manager.hold()
    clock.advance(STARTUP_MS * 5)
    await flush()
    assert.equal(manager.getPhase().status, 'requesting')
    hidden = false
    clock.advance(STARTUP_MS)
    await flush()
    assert.equal(manager.getPhase().status, 'timed-out')
  })

  test('an insecure page fails without calling getUserMedia', async () => {
    const { media, manager } = setup({ checkSupport: () => 'insecure' })
    manager.hold()
    await flush()
    assert.deepEqual(manager.getPhase(), { status: 'failed', kind: 'insecure' })
    assert.equal(media.stats().calls, 0)
  })
})

describe('camera ownership and cleanup', () => {
  test('unmount before startup completes: the late stream is stopped, not kept', async () => {
    const { clock, media, manager } = setup()
    const release = manager.hold()
    release()
    clock.advance(KEEP_ALIVE_MS)

    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()
    assert.equal(track.readyState, 'ended')
    assert.equal(manager.getPhase().status, 'idle')
    assert.deepEqual(manager.inspect(), { holders: 0, pending: false, hasStream: false })
  })

  test('repeated retries after a failure start one request at a time', async () => {
    const { media, manager } = setup()
    manager.hold()
    media.last().reject(domError('NotAllowedError'))
    await flush()

    assert.equal(manager.retry(), true)
    assert.equal(manager.retry(), false)
    assert.equal(manager.retry(), false)
    assert.equal(media.stats().calls, 2)
    assert.equal(media.stats().maxPending, 1)
  })

  test('a stream arriving during the keep-alive is kept for the next screen (no second prompt)', async () => {
    const { clock, media, manager } = setup()
    const releaseReady = manager.hold()
    releaseReady()
    clock.advance(KEEP_ALIVE_MS / 2)
    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()
    assert.equal(track.readyState, 'live')

    manager.hold()
    clock.advance(KEEP_ALIVE_MS * 2)
    assert.deepEqual(manager.getPhase(), { status: 'ready', stream })
    assert.equal(media.stats().calls, 1)
  })

  test('a stream arriving during the keep-alive is still stopped if nobody comes back', async () => {
    const { clock, media, manager } = setup()
    manager.hold()()
    clock.advance(KEEP_ALIVE_MS / 2)
    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()
    clock.advance(KEEP_ALIVE_MS)
    assert.equal(track.readyState, 'ended')
    assert.deepEqual(manager.inspect(), { holders: 0, pending: false, hasStream: false })
  })

  test('retry without anyone holding the camera does nothing', () => {
    const { media, manager } = setup()
    assert.equal(manager.retry(), false)
    assert.equal(media.stats().calls, 0)
  })

  test('concurrent holders share one request and one stream', async () => {
    const { media, manager } = setup()
    manager.hold()
    manager.hold()
    assert.equal(media.stats().calls, 1)
    media.last().resolve(createStream().stream)
    await flush()
    assert.equal(manager.inspect().holders, 2)
    assert.equal(manager.getPhase().status, 'ready')
  })

  test('the stream stops after the keep-alive once the last holder leaves', async () => {
    const { clock, media, manager } = setup()
    const releaseA = manager.hold()
    const releaseB = manager.hold()
    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()

    releaseA()
    clock.advance(KEEP_ALIVE_MS * 2)
    assert.equal(track.readyState, 'live', 'still held by B')

    releaseB()
    releaseB()
    assert.equal(manager.inspect().holders, 0, 'double release does not go negative')
    clock.advance(KEEP_ALIVE_MS - 1)
    assert.equal(track.readyState, 'live')
    clock.advance(1)
    assert.equal(track.readyState, 'ended')
    assert.equal(manager.getPhase().status, 'idle')
  })

  test('Ready → Capture reuses the stream within the keep-alive', async () => {
    const { clock, media, manager } = setup()
    const releaseReady = manager.hold()
    const { stream, track } = createStream()
    media.last().resolve(stream)
    await flush()

    releaseReady()
    clock.advance(KEEP_ALIVE_MS / 2)
    manager.hold()
    clock.advance(KEEP_ALIVE_MS * 2)
    assert.deepEqual(manager.getPhase(), { status: 'ready', stream })
    assert.equal(track.readyState, 'live')
    assert.equal(media.stats().calls, 1)
  })

  test('a dead stream is replaced on the next hold', async () => {
    const { media, manager } = setup()
    manager.hold()
    const first = createStream()
    media.last().resolve(first.stream)
    await flush()
    first.track.readyState = 'ended'

    manager.hold()
    assert.equal(media.stats().calls, 2)
    assert.equal(manager.getPhase().status, 'requesting')
  })

  test('a full lifecycle leaks no holder, request, stream or timer', async () => {
    const { clock, media, manager } = setup()
    const tracks: FakeTrack[] = []
    for (let round = 0; round < 5; round += 1) {
      const release = manager.hold()
      const { stream, track } = createStream()
      tracks.push(track)
      media.last().resolve(stream)
      await flush()
      release()
      clock.advance(KEEP_ALIVE_MS)
    }
    assert.deepEqual(manager.inspect(), { holders: 0, pending: false, hasStream: false })
    assert.equal(clock.pending(), 0)
    assert.equal(media.stats().calls, 5)
    assert.ok(tracks.every((track) => track.readyState === 'ended'))
    assert.equal(media.stats().maxPending, 1)
  })
})

describe('camera error classification', () => {
  test('maps browser errors to what the user can do about them', () => {
    const cases: Array<[string, string]> = [
      ['NotAllowedError', 'permission-denied'],
      ['SecurityError', 'permission-denied'],
      ['NotFoundError', 'not-found'],
      ['OverconstrainedError', 'not-found'],
      ['NotReadableError', 'in-use'],
      ['AbortError', 'in-use'],
      ['NotSupportedError', 'unsupported'],
      ['TypeError', 'unsupported'],
      ['SomethingNew', 'unknown'],
    ]
    for (const [name, kind] of cases) assert.equal(classifyCameraError(domError(name)), kind, name)
  })
})
