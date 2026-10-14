import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({
  ...atomicShop,
  testDir: '.',
  testMatch: ['ui-pro-media-settings.spec.ts', 'atomic-dashboard.spec.ts', 'atomic-appointments.spec.ts', 'plan-owner.spec.ts', 'atomic-billing.spec.ts', 'atomic-landing.spec.ts', 'post-unification-regressions.spec.ts', 'ss-launch-pos-customer-001-1.spec.ts'],
  grep: /en, light, 1440|ar, dark, 390|settings|profile|sidebar|POS|appointment customer|public pricing|Multi switch/i,
  outputDir: '../../../../test-results/shop-ui-pro',
  use: { ...atomicShop.use, launchOptions: process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : undefined },
})
