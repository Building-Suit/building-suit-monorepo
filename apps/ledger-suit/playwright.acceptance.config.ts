import { defineConfig } from '@playwright/test'
import financial from '../../packages/testing/playwright.atomic-ledger-financial.config'

export default defineConfig({
  ...financial,
  testDir: './tests/e2e',
  use: { ...financial.use, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
})
