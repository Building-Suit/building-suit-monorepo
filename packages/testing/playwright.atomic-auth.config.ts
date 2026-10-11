import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
export default defineConfig({
  ...foundation,
  testMatch: ['atomic-auth-parity.spec.ts', 'atomic-signup-parity.spec.ts'],
  fullyParallel: false,
  workers: 1,
  webServer: Array.isArray(foundation.webServer) ? foundation.webServer.slice(0, 2) : foundation.webServer,
})
