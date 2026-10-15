import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: '.', testMatch: 'public-changelog.spec.ts', workers: 1, retries: 0,
  outputDir: '../../../../test-results/public-changelog', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4393', screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/shop-suit/.output/server/index.mjs', cwd: fileURLToPath(new URL('../../../../', import.meta.url)), url: 'http://127.0.0.1:4393', env: { PORT: '4393', HOST: '127.0.0.1' }, reuseExistingServer: false, timeout: 120000 },
})
