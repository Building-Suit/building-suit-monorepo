import { defineConfig } from '@playwright/test'
import workspace from '../../../../packages/testing/playwright.config'

const shopServer = Array.isArray(workspace.webServer) ? workspace.webServer[1] : undefined
if (!shopServer) throw new Error('Shop browser server configuration is missing')

export default defineConfig({
  testDir: '.', testMatch: 'ss-launch-solo-variants-001-2.spec.ts',
  workers: 1, retries: 0, reporter: 'list',
  outputDir: '../../../../test-results/ss-launch-solo-variants-001',
  use: { baseURL: 'http://127.0.0.1:4328', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [{ ...shopServer, url: 'http://127.0.0.1:4328/auth/login', env: { ...shopServer.env, PORT: '4328' } }],
})
