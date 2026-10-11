import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
const servers = Array.isArray(foundation.webServer) ? foundation.webServer : []
const inventory = servers[3]
if (!inventory) throw new Error('Inventory server configuration missing')
export default defineConfig({
  testDir: './e2e', testMatch: 'atomic-bootstrap-parity.spec.ts', workers: 1, retries: 0, outputDir: '../../test-results/atomic-bootstrap',
  use: { browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [inventory, { ...inventory, command: 'node apps/super-admin-suit/.output/server/index.mjs', url: 'http://127.0.0.1:4325/', env: { ...inventory.env, PORT: '4325', APP_URL: 'http://127.0.0.1:4325', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-super-admin-local-auth-token', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:63321' } }],
})
