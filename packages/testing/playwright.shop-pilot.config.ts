import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  testDir: fileURLToPath(new URL('../../apps/shop-suit/tests/e2e', import.meta.url)), testMatch: 'pilot-usability.spec.ts',
  workers: 2, retries: 0, reporter: 'list', outputDir: fileURLToPath(new URL('../../test-results/shop-pilot', import.meta.url)),
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4421', trace: 'retain-on-failure' },
  webServer: {
    command: 'node apps/shop-suit/.output/server/index.mjs', cwd: root,
    url: 'http://127.0.0.1:4421/auth/login', reuseExistingServer: false,
    env: { PORT: '4421', HOST: '127.0.0.1', APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:61321', NUXT_PUBLIC_SUPABASE_KEY: 'local-ui-test-key' },
  },
})
