import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: '.', testMatch: 'bs-changelog-version-001-2.spec.ts', workers: 1, retries: 0,
  outputDir: '../../../../test-results/changelog', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4392', screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/building-suit-docs/.output/server/index.mjs', cwd: fileURLToPath(new URL('../../../../', import.meta.url)), url: 'http://127.0.0.1:4392/components', env: { PORT: '4392', HOST: '127.0.0.1' }, reuseExistingServer: false, timeout: 120000 },
})
