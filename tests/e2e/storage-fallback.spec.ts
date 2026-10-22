import { expect, test, type Page } from '@playwright/test'
import { decodedBlobImages, expectCameraReady, expectRoute, goToCapture, readStorage, shoot, startExperience } from './helpers/app'

const WRITES_SWITCH = 'e2e.photoWrites'

/**
 * Makes IndexedDB refuse photo writes: every write, a chosen set of write
 * calls, or (switchable) until sessionStorage[WRITES_SWITCH] is 'on'.
 */
async function failPhotoWrites(page: Page, mode: { name: string; calls?: number[]; switchable?: boolean }) {
  await page.addInitScript(
    ({ name, calls, switchable, key }) => {
      const put = IDBObjectStore.prototype.put
      let count = 0
      IDBObjectStore.prototype.put = function (value: unknown, storeKey?: IDBValidKey) {
        if (this.name === 'photos') {
          count += 1
          const fail = switchable ? sessionStorage.getItem(key) !== 'on' : !calls || calls.includes(count)
          if (fail) throw new DOMException('Write refused by the test', name)
        }
        return put.call(this, value, storeKey)
      }
    },
    { ...mode, key: WRITES_SWITCH }
  )
}

test('without IndexedDB: warned up front, photos kept in memory, reload loss recovered', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
  })
  await startExperience(page, 'Quick 4')
  await expect(page.getByText(/không cho lưu ảnh lâu dài/)).toBeVisible()
  await goToCapture(page, 'Tắt')
  await shoot(page, 4)
  await expectRoute(page, '/review')
  await expect.poll(() => decodedBlobImages(page)).toBe(4)

  await page.reload()
  await expect(page.getByText('4 ảnh không còn trên máy này')).toBeVisible()
  await expect(page.getByRole('button', { name: /Vào Studio/ })).toBeDisabled()
  await page.getByRole('button', { name: /Chụp lại 4 ảnh/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
  await shoot(page, 4)
  await expectRoute(page, '/review')
  expect((await readStorage(page)).session!.shots.every(Boolean)).toBe(true)
})

test('quota exceeded: capture continues in memory and says so', async ({ page }) => {
  await failPhotoWrites(page, { name: 'QuotaExceededError' })
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')
  await shoot(page, 1)
  await expect(page.getByText(/1 ảnh chỉ được giữ tạm trong tab này vì bộ nhớ trình duyệt đã đầy/)).toBeVisible()
  await shoot(page, 3)
  await expectRoute(page, '/review')
  await expect.poll(() => decodedBlobImages(page)).toBe(4)
  const state = await readStorage(page)
  expect(state.session!.shots.every(Boolean)).toBe(true)
  expect(state.photos).toHaveLength(0)
})

test('mixed storage: one memory photo keeps the warning, and a reload loses only that one', async ({ page }) => {
  // Photo 1 is persisted; photo 2 fails (write and its retry); photos 3 and 4 are persisted.
  await failPhotoWrites(page, { name: 'UnknownError', calls: [2, 3] })
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')
  await shoot(page, 3)
  await expect(page.getByText(/^1 ảnh chỉ được giữ tạm trong tab này/)).toBeVisible()
  await shoot(page, 1)
  await expectRoute(page, '/review')
  expect((await readStorage(page)).photos).toHaveLength(3)

  await page.reload()
  await expect(page.getByText('1 ảnh không còn trên máy này')).toBeVisible()
  await page.getByRole('button', { name: /Chụp lại 1 ảnh/ }).click()
  await expectRoute(page, '/capture')
  await expectCameraReady(page)
  await shoot(page, 1)
  await expectRoute(page, '/review')
  expect((await readStorage(page)).photos).toHaveLength(4)
})

test('storage that recovers: a new session in the same page carries no stale warning', async ({ page }) => {
  await failPhotoWrites(page, { name: 'UnknownError', switchable: true })
  await startExperience(page, 'Quick 4')
  await goToCapture(page, 'Tắt')
  await shoot(page, 4)
  await expectRoute(page, '/review')
  expect((await readStorage(page)).photos).toHaveLength(0)

  // Storage works again; everything below stays in the same page (no reload),
  // so the old session's memory photos really existed until it was ended.
  await page.evaluate((key) => sessionStorage.setItem(key, 'on'), WRITES_SWITCH)
  await page.getByRole('button', { name: /Vào Studio/ }).click()
  await page.getByRole('button', { name: /Hoàn tất/ }).click()
  await expectRoute(page, '/result')
  await page.getByRole('button', { name: /Chụp phiên mới/ }).click()
  await page.getByRole('button', { name: /^Xác nhận/ }).click()
  await expectRoute(page, '/experience')
  await page.getByRole('radio', { name: /Duo/ }).click()
  await page.getByRole('button', { name: /^Tiếp tục/ }).click()
  await expectRoute(page, '/ready')
  await expectCameraReady(page)
  await expect(page.getByText(/chỉ được giữ tạm|không cho lưu ảnh lâu dài|không phản hồi/)).toHaveCount(0)

  await goToCapture(page, 'Tắt')
  await shoot(page, 1)
  await expect.poll(async () => (await readStorage(page)).photos.length).toBe(1)
  await expect(page.getByText(/chỉ được giữ tạm/)).toHaveCount(0)
})
