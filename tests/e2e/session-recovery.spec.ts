import { expect, test, type Page } from '@playwright/test'
import {
  SESSION_KEY,
  captureSession,
  decodedBlobImages,
  expectCameraReady,
  expectRoute,
  goToCapture,
  readStorage,
  shoot,
  startExperience,
} from './helpers/app'

/** Rewrites one stored photo behind the app's back: deleted, or replaced with bytes that are not an image. */
async function tamperWithPhoto(page: Page, id: string, mode: 'delete' | 'corrupt') {
  await page.evaluate(
    async ([photoId, how]) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('photobooth')
        request.onsuccess = () => resolve(request.result)
      })
      await new Promise<void>((resolve) => {
        const transaction = database.transaction('photos', 'readwrite')
        const store = transaction.objectStore('photos')
        if (how === 'delete') {
          store.delete(photoId)
        } else {
          const request = store.get(photoId)
          request.onsuccess = () => store.put({ ...request.result, blob: new Blob(['not a jpeg'], { type: 'image/jpeg' }) })
        }
        transaction.oncomplete = () => resolve()
      })
      database.close()
    },
    [id, mode] as const
  )
}

async function goToResult(page: Page) {
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await expectRoute(page, '/studio')
  await page.getByRole('button', { name: /Hoàn tất/ }).click()
  await expectRoute(page, '/result')
}

test('reloading Capture, Review, Studio and Result keeps every photo', async ({ page }) => {
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')
  await shoot(page, 2)
  await expect.poll(async () => (await readStorage(page)).session!.shots.filter(Boolean).length).toBe(2)
  await page.reload()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
  expect((await readStorage(page)).session!.shots.filter(Boolean)).toHaveLength(2)
  await shoot(page, 2)
  await expectRoute(page, '/review')

  for (const route of ['/review', '/studio', '/result']) {
    if (route === '/studio') await page.getByRole('button', { name: /Vào Studio/ }).click()
    if (route === '/result') await page.getByRole('button', { name: /Hoàn tất/ }).click()
    await expectRoute(page, route)
    await page.reload()
    await expectRoute(page, route)
    await expect.poll(() => decodedBlobImages(page)).toBeGreaterThanOrEqual(4)
    await expect(page.getByText(/không còn trên máy này|Chưa đọc được/)).toHaveCount(0)
  }
})

test('a missing photo is never rendered as if present; only its slot is re-shot', async ({ page }) => {
  const { session } = await captureSession(page, 'Quick 4', 4)
  await goToResult(page)
  await tamperWithPhoto(page, session!.shots[1]!, 'delete')
  await page.reload()

  await expect(page.getByText('1 ảnh không còn trên máy này')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tải ảnh PNG/ })).toBeDisabled()
  await page.getByRole('button', { name: /Chụp lại 1 ảnh/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)

  const released = (await readStorage(page)).session!
  expect(released.shots[1]).toBeNull()
  expect([0, 2, 3].map((index) => released.shots[index])).toEqual([0, 2, 3].map((index) => session!.shots[index]))
  expect(released.lookId).toBe(session!.lookId)

  await shoot(page, 1)
  await expectRoute(page, '/review')
  expect((await readStorage(page)).session!.shots.every(Boolean)).toBe(true)
})

test('an unreadable photo can be retried and is never dropped automatically', async ({ page }) => {
  const { session } = await captureSession(page, 'Quick 4', 4)
  await tamperWithPhoto(page, session!.shots[2]!, 'corrupt')
  await page.reload()

  await expect(page.getByText('Chưa đọc được 1 ảnh')).toBeVisible()
  await expect(page.getByRole('button', { name: /Vào Studio/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Chưa đọc được 1 ảnh')).toBeVisible()
  // Still referenced: unreadable is not "missing".
  expect((await readStorage(page)).session!.shots).toEqual(session!.shots)

  await page.getByRole('button', { name: /Chụp lại 1 ảnh/ }).click()
  await expectRoute(page, '/capture')
  expect((await readStorage(page)).session!.shots[2]).toBeNull()
})

test('retake keeps the originals until a new photo is chosen', async ({ page }) => {
  const captured = await captureSession(page, 'Quick 4', 4)
  const original = captured.session!.shots

  // First slot: take a new photo and use it.
  await page.getByRole('button', { name: 'Xem ảnh 1' }).click()
  await page.getByRole('button', { name: /Chụp lại ảnh này/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
  await page.locator('button[aria-label="Chụp lại"]').click()
  await expectRoute(page, '/review')
  await page.getByRole('button', { name: 'Dùng ảnh mới' }).click()
  await expect.poll(async () => (await readStorage(page)).session!.retake).toBeNull()
  let state = await readStorage(page)
  expect(state.session!.shots[0]).not.toBe(original[0])
  expect(state.session!.shots.slice(1)).toEqual(original.slice(1))
  await expect.poll(async () => (await readStorage(page)).photos.some((photo) => photo.id === original[0])).toBe(false)

  // Last slot: take a draft, keep the current photo instead.
  const before = state.session!.shots
  await page.getByRole('button', { name: 'Xem ảnh 4' }).click()
  await page.getByRole('button', { name: /Chụp lại ảnh này/ }).click()
  await expectCameraReady(page)
  await page.locator('button[aria-label="Chụp lại"]').click()
  await expectRoute(page, '/review')
  const draft = (await readStorage(page)).session!.retake!.draftPhotoId
  await page.getByRole('button', { name: 'Giữ ảnh hiện tại' }).click()
  await expect.poll(async () => (await readStorage(page)).photos.some((photo) => photo.id === draft)).toBe(false)
  state = await readStorage(page)
  expect(state.session!.shots).toEqual(before)

  // Cancel from the capture screen before shooting.
  await page.getByRole('button', { name: 'Xem ảnh 4' }).click()
  await page.getByRole('button', { name: /Chụp lại ảnh này/ }).click()
  await expectRoute(page, '/capture')
  await page.getByRole('button', { name: 'Hủy chụp lại' }).click()
  await expectRoute(page, '/review')
  state = await readStorage(page)
  expect(state.session!.retake).toBeNull()
  expect(state.session!.shots).toEqual(before)
})

test('a duplicated tab lets go of its copy and never touches the owner’s photos', async ({ page, context }) => {
  const owner = await captureSession(page, 'Quick 4', 4)
  const copy = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY)

  for (const route of ['ready/', 'experience/']) {
    const duplicate = await context.newPage()
    await duplicate.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, value)
      },
      [SESSION_KEY, copy!] as const
    )
    await duplicate.goto(route)
    await expectRoute(duplicate, '/experience')
    await expect(duplicate.getByText(/đang mở ở một tab khác/)).toBeVisible()
    await expect(duplicate.getByRole('link', { name: /Tiếp tục phiên cũ/ })).toHaveCount(0)
    await duplicate.getByRole('button', { name: /^Tiếp tục/ }).click()
    await expectRoute(duplicate, '/ready')
    await duplicate.close()
  }

  const after = await readStorage(page)
  expect(after.session!.id).toBe(owner.session!.id)
  for (const id of owner.session!.shots) expect(after.photos.some((photo) => photo.id === id)).toBe(true)
  expect(after.sessions.find((record) => record.id === owner.session!.id)?.endedAt).toBeNull()
})
