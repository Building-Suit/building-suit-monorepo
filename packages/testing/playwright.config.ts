import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 2, retries: 0,
  reporter: [['list']], outputDir: '../../test-results',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node apps/ledger-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4320/login', env: { APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-ledger-local-auth-token', PORT: '4320', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:60321', NUXT_PUBLIC_SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }, reuseExistingServer: false, timeout: 120000 },
    { command: 'node apps/shop-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4321/auth/login', env: { APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-shop-local-auth-token', PORT: '4321', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:61321', NUXT_PUBLIC_SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }, reuseExistingServer: false, timeout: 120000 },
    { command: 'node apps/building-suit-docs/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4322/', env: { PORT: '4322', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:60321', NUXT_PUBLIC_SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }, reuseExistingServer: false, timeout: 120000 },
    { command: 'node apps/inventory-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4323/', env: { APP_ENV: 'local', APP_URL: 'http://127.0.0.1:4323', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-inventory-local-auth-token', PORT: '4323', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:62321', NUXT_PUBLIC_SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }, reuseExistingServer: false, timeout: 120000 },
  ],
})
