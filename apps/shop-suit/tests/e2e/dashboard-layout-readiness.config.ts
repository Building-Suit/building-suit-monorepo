import { defineConfig } from '@playwright/test'
import workspace from '../../../../packages/testing/playwright.config'
const shopServer = Array.isArray(workspace.webServer) ? workspace.webServer[1] : undefined
if (!shopServer) throw new Error('Shop server configuration is missing')
export default defineConfig({
  testDir: '.', testMatch: ['dashboard-layout-readiness.spec.ts'], workers: 1, retries: 0,
  reporter: 'list', outputDir: '../../../../test-results/dashboard-layout-readiness',
  use: { baseURL: 'http://127.0.0.1:4340', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node apps/shop-suit/tests/e2e/dashboard-layout-fixture-server.mjs', cwd: shopServer.cwd, url: 'http://127.0.0.1:4440/ready', reuseExistingServer: false },
    { ...shopServer, command: 'node apps/shop-suit/.output/server/index.mjs', url: 'http://127.0.0.1:4340/auth/login', env: { ...shopServer.env, PORT: '4340', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4440' } },
  ],
})
