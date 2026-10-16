import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['website-profile.spec.ts'], outputDir: '../../../../test-results/website-profile',
  use: { ...atomicShop.use, launchOptions: process.env.WEBSITE_TEST_CHROMIUM ? { executablePath: process.env.WEBSITE_TEST_CHROMIUM } : undefined },
})
