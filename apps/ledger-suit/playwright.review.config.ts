import { defineConfig, devices } from '@playwright/test'

// Synthetic UI evidence only; never starts or contacts the Ledger database.
export default defineConfig({
  testDir: './tests',
  testMatch: 'review-journey.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3216', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm review:dev',
    url: 'http://127.0.0.1:3216',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
