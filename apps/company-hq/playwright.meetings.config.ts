import { defineConfig, devices } from '@playwright/test'

/** Run only against the explicit disposable meeting-preview process. */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'meetings.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: './test-results/meetings',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.HQ_MEETING_PREVIEW_URL ?? 'http://127.0.0.1:4347',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_USE_BUNDLED ? {} : { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
  },
})
