import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineConfig({
  testDir: '.', testMatch: 'marketing-privacy.spec.ts', workers: 1, retries: 0,
  outputDir: '../../../../test-results/marketing-privacy', reporter: 'list',
  use: { browserName: 'chromium', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [{ command: 'node apps/shop-suit/tests/e2e/marketing-privacy-fixture.mjs', cwd: root, url: 'http://127.0.0.1:46423/ready', reuseExistingServer: false }, ...[4337, 4338, 4339].map(port => ({
    command: 'node apps/shop-suit/.output/server/index.mjs', cwd: root, url: `http://127.0.0.1:${port}/auth/login`,
    reuseExistingServer: false, timeout: 120000,
    env: { HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_APP_ENVIRONMENT: port === 4338 ? 'staging' : 'production',
      NUXT_PUBLIC_GA_MEASUREMENT_ID: port === 4339 ? '' : 'G-TESTONLY',
      NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:46423', NUXT_PUBLIC_SUPABASE_KEY: 'local-fixture-publishable-key' },
  }))],
})
