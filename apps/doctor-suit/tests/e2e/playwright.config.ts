import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { assertLocalFixtureEnvironment } from './safety.mjs'

assertLocalFixtureEnvironment(process.env)
const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.spec.ts', testIgnore:'**/dos-m2-*.spec.ts', workers: 1, retries: 0,
  outputDir: fileURLToPath(new URL('../../../../test-results/doctor', import.meta.url)),
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4336', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node apps/doctor-suit/.output/server/index.mjs', cwd: root,
    url: 'http://127.0.0.1:4336', reuseExistingServer: false,
    env: { NITRO_HOST: '127.0.0.1', NITRO_PORT: '4336', APP_URL: 'http://127.0.0.1:4336' },
  },
})
