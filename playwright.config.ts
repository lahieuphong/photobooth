import { defineConfig, devices } from '@playwright/test'

// E2E smoke tests run against the production static export (`yarn build`),
// served under the same base path as GitHub Pages. The camera is Chromium's
// built-in fake device (a synthetic test pattern): these are mocked-camera
// tests, never a substitute for checking real devices.

const basePath = process.env.E2E_BASE_PATH ?? '/photobooth'
const port = Number(process.env.E2E_PORT ?? 4173)
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry in CI absorbs a rare runner hiccup; a test that needs it is still reported as flaky.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    // Trailing slash: relative paths like 'welcome/' resolve inside the base path.
    baseURL: `${origin}${basePath}/`,
    permissions: ['camera'],
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The full Chromium build in new headless mode: in the lighter headless shell
        // getUserMedia rejects with NotSupportedError even with the fake device.
        channel: 'chromium',
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: `${origin}${basePath}/welcome/`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_BASE_PATH: basePath, E2E_PORT: String(port) },
    stdout: 'pipe',
  },
})
