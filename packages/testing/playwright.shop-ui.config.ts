import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  testDir: './e2e', testMatch: 'shop-ui-foundation.spec.ts', workers: 2, retries: 0,
  reporter: 'list', outputDir: '../../test-results/shop-ui',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  webServer: [
    { command: 'node apps/building-suit-docs/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4422/components', env: { PORT: '4422', HOST: '127.0.0.1' }, reuseExistingServer: false },
    { command: 'node apps/shop-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4421/auth/login', env: { PORT: '4421', HOST: '127.0.0.1', APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:61321', NUXT_PUBLIC_SUPABASE_KEY: 'local-ui-test-key' }, reuseExistingServer: false },
  ],
})
