import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Keep the auth fixture separate from product Supabase ports (including Super Admin's 64321).
const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  testDir: fileURLToPath(new URL('../../apps/shop-suit/tests/e2e', import.meta.url)),
  testMatch: 'auth-otp.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: fileURLToPath(new URL('../../test-results/shop-auth-otp', import.meta.url)),
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4422', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node apps/shop-suit/tests/e2e/auth-otp-server.mjs', cwd: root, url: 'http://127.0.0.1:4432/__state', env: { PORT: '4432' }, reuseExistingServer: false },
    {
      command: 'node apps/shop-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4422/auth/signup', reuseExistingServer: false,
      env: { PORT: '4422', HOST: '127.0.0.1', APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4432', NUXT_PUBLIC_SUPABASE_KEY: 'local-auth-otp-test-key' },
    },
  ],
})
