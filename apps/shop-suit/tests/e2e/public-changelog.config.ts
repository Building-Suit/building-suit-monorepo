import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: '.', testMatch: 'public-changelog.spec.ts', workers: 1, retries: 0,
  globalSetup: './public-changelog.setup.mjs',
  outputDir: '../../../../test-results/public-changelog', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4393', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/shop-suit/tests/e2e/public-changelog-fixture-server.mjs', cwd: fileURLToPath(new URL('../../../../', import.meta.url)), url: 'http://127.0.0.1:4393', reuseExistingServer: false, timeout: 120000 },
})
