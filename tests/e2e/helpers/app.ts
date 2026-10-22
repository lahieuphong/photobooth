import { expect, type Page } from '@playwright/test'

export const SESSION_KEY = 'photobooth.session.v2'

export type StoredState = {
  session: { id: string; shots: Array<string | null>; retake: { shotIndex: number; draftPhotoId: string | null } | null; lookId: string; frameId: string; layoutId: string; status: string } | null
  photos: Array<{ id: string; sessionId: string; size: number }>
  sessions: Array<{ id: string; lastActiveAt: number; endedAt: number | null }>
}

/** Route inside the base path, e.g. '/review'. */
export function routeOf(page: Page) {
  const base = new URL(page.url()).pathname.match(/^(.*?)\/(welcome|experience|ready|capture|review|studio|result)\/?$/)
  return base ? `/${base[2]}` : new URL(page.url()).pathname
}

export async function expectRoute(page: Page, route: string, timeout = 15_000) {
  await expect.poll(() => routeOf(page), { timeout }).toBe(route)
}

/** sessionStorage session plus what IndexedDB holds (ids and sizes only). */
export async function readStorage(page: Page): Promise<StoredState> {
  return page.evaluate(async (key) => {
    const session = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    const database = await new Promise<IDBDatabase | null>((resolve) => {
      if (!window.indexedDB) return resolve(null)
      const request = indexedDB.open('photobooth')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
    if (!database || !database.objectStoreNames.contains('photos')) {
      database?.close()
      return { session, photos: [], sessions: [] }
    }
    const readAll = <T>(store: string) =>
      new Promise<T[]>((resolve) => {
        const request = database.transaction(store).objectStore(store).getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => resolve([])
      })
    const photos = (await readAll<{ id: string; sessionId: string; blob?: Blob }>('photos')).map((photo) => ({
      id: photo.id,
      sessionId: photo.sessionId,
      size: photo.blob?.size ?? 0,
    }))
    const sessions = database.objectStoreNames.contains('sessions')
      ? await readAll<{ id: string; lastActiveAt: number; endedAt: number | null }>('sessions')
      : []
    database.close()
    return { session, photos, sessions }
  }, SESSION_KEY)
}

export async function capturedCount(page: Page) {
  return page.evaluate((key) => (JSON.parse(sessionStorage.getItem(key) ?? 'null')?.shots ?? []).filter(Boolean).length, SESSION_KEY)
}

export async function startExperience(page: Page, title: string) {
  await page.goto('welcome/')
  await page.getByRole('link', { name: /Bắt đầu/ }).click()
  await expectRoute(page, '/experience')
  await page.getByRole('radio', { name: new RegExp(title) }).click()
  const restart = page.getByRole('button', { name: /^Bắt đầu lại/ })
  if (await restart.isVisible()) {
    await restart.click()
    await page.getByRole('button', { name: /^Xác nhận bắt đầu lại/ }).click()
  } else {
    await page.getByRole('button', { name: /^Tiếp tục/ }).click()
  }
  await expectRoute(page, '/ready')
}

/** The live video is attached, playing and shown. */
export async function expectCameraReady(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const video = document.querySelector('video')
          return Boolean(video && video.readyState >= 2 && !video.paused && getComputedStyle(video).opacity === '1')
        }),
      { timeout: 20_000 }
    )
    .toBe(true)
}

/** Ready → Capture with the given countdown label ('Tắt', '5s', '10s', '15s'). */
export async function goToCapture(page: Page, countdownLabel: string) {
  await expectCameraReady(page)
  await page.getByRole('button', { name: countdownLabel, exact: true }).click()
  await page.getByRole('button', { name: /Sẵn sàng chụp/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
}

/** Untimed shutter presses: one photo each, waiting until each is stored. */
export async function shoot(page: Page, shots: number) {
  for (let index = 0; index < shots; index += 1) {
    const before = await capturedCount(page)
    const shutter = page.locator('button[aria-label="Chụp"], button[aria-label="Chụp lại"]')
    await expect(shutter).toBeEnabled({ timeout: 20_000 })
    await shutter.click()
    if (index < shots - 1) await expect.poll(() => capturedCount(page)).toBeGreaterThan(before)
  }
}

/** Blob images on screen that actually decoded. */
export async function decodedBlobImages(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('img')].filter((img) => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0).length)
}

/** Full Welcome → Review run with countdown off. */
export async function captureSession(page: Page, title: string, shots: number) {
  await startExperience(page, title)
  await goToCapture(page, 'Tắt')
  await shoot(page, shots)
  await expectRoute(page, '/review')
  return readStorage(page)
}
