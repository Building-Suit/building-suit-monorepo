import { defineConfig } from '@playwright/test'
import pilot from '../../packages/testing/playwright.shop-pilot.config'

const pilotWebServer = Array.isArray(pilot.webServer) ? pilot.webServer[0] : pilot.webServer

export default defineConfig({
  ...pilot,
  testMatch: 'plan-owner.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/shop-plan-ui',
  webServer: {
    ...pilotWebServer,
    command: 'pnpm --filter @building-suit/shop-suit build && node apps/shop-suit/.output/server/index.mjs',
  },
})
