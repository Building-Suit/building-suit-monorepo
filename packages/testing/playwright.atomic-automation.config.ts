import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: './e2e', testMatch: 'atomic-automation.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list']], outputDir: '../../test-results/atomic-automation',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/automation-suit/.output/server/index.mjs', cwd: fileURLToPath(new URL('../../', import.meta.url)), url: 'http://127.0.0.1:4324/n8n', env: { PORT: '4324', HOST: '127.0.0.1', NUXT_DASHBOARD_AUTH_REQUIRED: 'false', NUXT_CONTROL_DATABASE_URL: '', NUXT_CONTROL_OPERATOR_DATABASE_URL: '', NUXT_PUBLIC_DASHBOARD_REFRESH_SECONDS: '3600' }, reuseExistingServer: false, timeout: 120000 },
})
