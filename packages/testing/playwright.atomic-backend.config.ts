import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
const servers = Array.isArray(foundation.webServer) ? foundation.webServer : []
const ledgerApi = process.env.BS_ATOMIC_BACKEND_LEDGER_API
const shopApi = process.env.BS_ATOMIC_BACKEND_SHOP_API
const ledgerKey = process.env.BS_ATOMIC_BACKEND_LEDGER_PUBLIC_KEY
const shopKey = process.env.BS_ATOMIC_BACKEND_SHOP_PUBLIC_KEY
if (!ledgerApi || !shopApi || !ledgerKey || !shopKey || !process.env.BS_ATOMIC_BACKEND_SHOP_MAIL) throw new Error('Explicit disposable Ledger/Shop API, public key and mail endpoints are required')
for (const url of [ledgerApi, shopApi, process.env.BS_ATOMIC_BACKEND_SHOP_MAIL]) if (new URL(url).hostname !== '127.0.0.1') throw new Error('Backend acceptance is restricted to explicitly disposable localhost instances')
process.env.BUILDING_TEST_BACKEND = '1'
process.env.BS_E2E_BACKEND_LEDGER_ORIGIN = 'http://127.0.0.1:4344'
process.env.BS_E2E_BACKEND_SHOP_ORIGIN = 'http://127.0.0.1:4345'
export default defineConfig({
 testDir: './e2e', testMatch: 'shop-backend.spec.ts', workers: 1, retries: 0, outputDir: '../../test-results/atomic-backend',
 use: { browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
 webServer: servers.slice(0, 2).map((server, index) => ({ ...server, url: server.url?.replace(/:432[01]/, `:${4344 + index}`), env: { ...server.env, PORT: String(4344 + index), APP_URL: `http://127.0.0.1:${4344 + index}`, NUXT_PUBLIC_SUPABASE_URL: index ? shopApi : ledgerApi, NUXT_PUBLIC_SUPABASE_KEY: index ? shopKey : ledgerKey } })),
})
