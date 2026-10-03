import { defineConfig } from '@playwright/test'
import pilot from '../../packages/testing/playwright.shop-pilot.config'

export default defineConfig(pilot, {
  testMatch: 'shared-ui-foundation.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/shop-shared-ui',
})
