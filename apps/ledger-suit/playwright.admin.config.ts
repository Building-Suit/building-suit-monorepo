import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'platform-admin.spec.ts', workers: 1,
  outputDir: './test-results/platform-admin', reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4330', trace: 'retain-on-failure' },
  webServer: {
    command: 'node .output/server/index.mjs', url: 'http://127.0.0.1:4330/login', reuseExistingServer: false,
    env: { PORT: '4330', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:60321', NUXT_PUBLIC_SUPABASE_KEY: 'local-mocked-publishable-key' },
  },
})
