import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

assert.equal(process.env.LEDGER_BROWSER_DISPOSABLE_TEST, '1')
const directory = fileURLToPath(new URL('../../.local/verification/browser/', import.meta.url))
const owner = JSON.parse(readFileSync(directory + 'owned-test-project.json', 'utf8'))
assert.equal(owner.task, 'LS-BROWSER-001'); assert.equal(owner.project, 'ledger-browser-20261026')
assert.equal(realpathSync(owner.workdir), realpathSync(directory))
assert.equal(owner.api_port, 61021); assert.equal(owner.ui_port, 61030)
const { anon } = JSON.parse(readFileSync(directory + 'test-credentials.json', 'utf8'))

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'core-finance.spec.ts', workers: 1, retries: 0, reporter: 'list', timeout: 60_000,
  outputDir: '../../test-results/native-core-finance',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:61030', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: {
    command: 'node .output/server/index.mjs', url: 'http://127.0.0.1:61030/login', reuseExistingServer: false,
    env: { APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-ledger-local-auth-token', PORT: '61030', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:61021', NUXT_PUBLIC_SUPABASE_KEY: anon, SUPABASE_URL: 'http://127.0.0.1:61021', SUPABASE_KEY: anon },
  },
})
