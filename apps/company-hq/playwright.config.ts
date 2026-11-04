import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  snapshotPathTemplate: '../../docs/work-packages/company-hq/design/{arg}{ext}',
  testDir: './tests/browser', fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4337', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_USE_BUNDLED ? {} : { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'node scripts/test-server.mjs --synthetic-ceo-worker', url: 'http://127.0.0.1:4337', reuseExistingServer: false, timeout: 60_000 },
})
