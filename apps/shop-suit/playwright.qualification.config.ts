import { defineConfig, devices } from '@playwright/test'
import { root, apiUrl } from './tests/pilot/local-backend.mjs'

// Selecting this suite opts into synthetic writes on the fixed disposable local
// Shop backend. Set this before Playwright spawns both workers and the server;
// preserve an explicit opt-out. Standalone database/export/restore stay guarded.
process.env.SHOP_PILOT_DISPOSABLE ??= '1'

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'pilot-qualification.spec.ts',
  workers: 1, retries: 0, timeout: 90_000, reporter: 'list',
  outputDir: '../../test-results/shop-qualification',
  use: {
    ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4422',
    timezoneId: 'Africa/Cairo', trace: 'off', video: 'off', screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node apps/shop-suit/tests/pilot/server.mjs', cwd: root,
    url: 'http://127.0.0.1:4422/auth/login', reuseExistingServer: false,
    env: {
      PORT: '4422', HOST: '127.0.0.1', APP_ENV: 'local',
      NUXT_PUBLIC_SUPABASE_URL: apiUrl,
    },
  },
})
