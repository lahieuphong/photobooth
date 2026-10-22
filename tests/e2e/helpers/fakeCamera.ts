import type { Page } from '@playwright/test'

// Init scripts layered over Chromium's fake camera device. They replace
// navigator.mediaDevices.getUserMedia before the app loads, so a test decides
// how startup behaves; the real (fake-device) stream is used when it succeeds.

declare global {
  interface Window {
    __camera?: {
      calls: number
      /** Settles a held request: with the real stream, or with a DOMException name. */
      settle(outcome: { reject?: string }): Promise<void>
    }
  }
}

/** Every request stays pending until the test calls window.__camera.settle(). */
export async function holdCameraRequests(page: Page) {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    const waiting: Array<{ constraints: MediaStreamConstraints; resolve: (stream: MediaStream) => void; reject: (error: unknown) => void }> = []
    window.__camera = {
      calls: 0,
      async settle({ reject }) {
        const next = waiting.shift()
        if (!next) throw new Error('no pending camera request')
        if (reject) next.reject(new DOMException(reject, reject))
        else next.resolve(await original(next.constraints))
      },
    }
    navigator.mediaDevices.getUserMedia = (constraints) => {
      window.__camera!.calls += 1
      return new Promise((resolve, reject) => waiting.push({ constraints: constraints ?? {}, resolve, reject }))
    }
  })
}

/** The first `failures` requests fail with `name` (e.g. NotReadableError: camera busy). */
export async function failCameraRequests(page: Page, name: string, failures: number) {
  await page.addInitScript(
    ([errorName, count]) => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      let remaining = count
      navigator.mediaDevices.getUserMedia = (constraints) =>
        remaining-- > 0 ? Promise.reject(new DOMException(errorName, errorName)) : original(constraints)
    },
    [name, failures] as const
  )
}
