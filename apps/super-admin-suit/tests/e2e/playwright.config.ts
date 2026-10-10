import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: fileURLToPath(new URL('./', import.meta.url)), testMatch: 'auth.spec.ts', workers: 1, retries: 0,
  outputDir: fileURLToPath(new URL('../../.playwright-results/', import.meta.url)),
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4324', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node .output/server/index.mjs',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:4324', reuseExistingServer: false,
    env: { PORT: '4324', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:64321', NUXT_PUBLIC_SUPABASE_KEY: 'local-browser-test-key' },
  },
})
