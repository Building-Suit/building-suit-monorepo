import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import foundation from './playwright.config'
const shopServer = Array.isArray(foundation.webServer) ? foundation.webServer[1] : undefined
if (!shopServer) throw new Error('Shop browser server configuration is missing')
export default defineConfig({
  testDir: fileURLToPath(new URL('../../apps/shop-suit/tests/e2e', import.meta.url)), testMatch: ['atomic-catalogue.spec.ts', 'team.spec.ts'],
  workers: 1, retries: 0, reporter: 'list', outputDir: '../../test-results/atomic-shop',
  use: { baseURL: 'http://127.0.0.1:4326', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [{ ...shopServer, command: 'node apps/shop-suit/tests/e2e/cash-policy-fixture-server.mjs', url: 'http://127.0.0.1:4326', reuseExistingServer: false, env: { ...shopServer.env, SUPABASE_URL: 'http://127.0.0.1:46421', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:46421' } }],
})
