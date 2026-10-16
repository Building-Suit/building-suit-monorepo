import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'

const servers = Array.isArray(foundation.webServer) ? foundation.webServer : []
export default defineConfig({
  ...foundation,
  testMatch: 'settings-menu-focus.spec.ts', fullyParallel: false, workers: 1,
  outputDir: '../../test-results/settings-focus',
  // This suite never visits or checks an n8n route/service. Automation is a
  // disconnected local UI with empty control database bindings.
  webServer: servers.map((server, index) => index === 4 ? { ...server, url: 'http://127.0.0.1:4324/' } : server),
})
