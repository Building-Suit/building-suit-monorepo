import { defineConfig } from '@playwright/test'
import workspace from '../../../../packages/testing/playwright.config'
const shopServer = Array.isArray(workspace.webServer) ? workspace.webServer[1] : undefined
if (!shopServer) throw new Error('Shop browser server configuration is missing')
export default defineConfig({
  testDir: '.', testMatch: 'ss-launch-cash-policy-001-2.spec.ts',
  workers: 1, retries: 0, reporter: 'list',
  outputDir: '../../../../test-results/ss-launch-cash-policy-001',
  use: { baseURL: 'http://127.0.0.1:4326', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [{ ...shopServer, command: 'pnpm --filter @building-suit/shop-suit build && node apps/shop-suit/tests/e2e/cash-policy-fixture-server.mjs', url: 'http://127.0.0.1:4326', reuseExistingServer: false, env: { ...shopServer.env, SUPABASE_URL: 'http://127.0.0.1:46421', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:46421' } }],
})
