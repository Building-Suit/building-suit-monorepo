import { defineConfig } from '@playwright/test'
import workspace from '../../../../packages/testing/playwright.config'
const shopServer = Array.isArray(workspace.webServer) ? workspace.webServer[1] : undefined
if (!shopServer) throw new Error('Shop browser server configuration is missing')
export default defineConfig({
  testDir: '.', testMatch: 'ss-launch-single-session-001-2.spec.ts',
  workers: 1, retries: 0, reporter: 'list',
  outputDir: '../../../../test-results/ss-launch-single-session-001',
  use: { baseURL: 'http://127.0.0.1:4338', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node apps/shop-suit/tests/e2e/single-session-fixture-server.mjs', cwd: shopServer.cwd, url: 'http://127.0.0.1:4438/ready', reuseExistingServer: false },
    { ...shopServer, command: 'pnpm --filter @building-suit/shop-suit build && node apps/shop-suit/.output/server/index.mjs', url: 'http://127.0.0.1:4338/auth/login', env: { ...shopServer.env, PORT: '4338', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4438' } },
  ],
})
