import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { assertLocalFixtureEnvironment } from './safety.mjs'
assertLocalFixtureEnvironment(process.env)
const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)), testMatch: '*.auth.fixture.ts', workers: 1, retries: 0,
  outputDir: fileURLToPath(new URL('../../../../test-results/doctor-auth', import.meta.url)), reporter: 'list',
  // Credential fixtures must never become trace/screenshot artifacts.
  use: { baseURL: 'http://127.0.0.1:4337', browserName: 'chromium', trace: 'off', screenshot: 'off' },
  webServer: [
    { command: 'node apps/doctor-suit/tests/fixtures/auth-provider.mjs', cwd: root, url: 'http://127.0.0.1:4338/__fixture', reuseExistingServer: false },
    { command: 'node apps/doctor-suit/.output/server/index.mjs', cwd: root, url: 'http://127.0.0.1:4337', reuseExistingServer: false, env: { NITRO_HOST: '127.0.0.1', NITRO_PORT: '4337', APP_URL: 'http://127.0.0.1:4337' } },
  ],
})
