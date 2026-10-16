import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['website-address.spec.ts'], outputDir: '../../../../test-results/website-address',
  use: { ...atomicShop.use, launchOptions: process.env.WEBSITE_TEST_CHROMIUM ? { executablePath: process.env.WEBSITE_TEST_CHROMIUM } : undefined },
})
