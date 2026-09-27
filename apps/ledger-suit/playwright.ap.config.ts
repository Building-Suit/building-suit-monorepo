import { defineConfig, devices } from '@playwright/test'
// Synthetic UI coverage; SQL fixtures independently test the real accounting.
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'supplier-subledger-ui.spec.ts', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3229', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec nuxt dev --host 127.0.0.1 --port 3229',
    url: 'http://127.0.0.1:3229/login', reuseExistingServer: false, timeout: 120_000,
    env: { SUPABASE_URL: 'http://127.0.0.1:60321', SUPABASE_KEY: 'ap-browser-fixture', APP_ENV: 'local' },
  },
})
