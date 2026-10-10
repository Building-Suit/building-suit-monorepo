import { defineConfig } from '@playwright/test'
import pilot from '../../packages/testing/playwright.shop-pilot.config'

export default defineConfig(pilot, {
  testMatch: ['public-legal.spec.ts', 'super-admin-bridge.spec.ts'],
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/shop-public-legal',
})
