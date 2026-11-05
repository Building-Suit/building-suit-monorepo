import { defineConfig, devices } from '@playwright/test'
const existingServer = process.env.PLAYWRIGHT_BASE_URL
export default defineConfig({
  snapshotPathTemplate: '../../docs/work-packages/company-hq/design/{arg}{ext}',
  testDir: './tests/browser', fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: existingServer ?? 'http://127.0.0.1:4337', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_USE_BUNDLED ? {} : { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: existingServer ? undefined : { command: 'node scripts/test-server.mjs', url: 'http://127.0.0.1:4337', reuseExistingServer: false, timeout: 60_000 },
})
