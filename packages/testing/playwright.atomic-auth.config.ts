import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
process.env.BS_ATOMIC_AUTH_PORT_BASE = '4340'
export default defineConfig({
  ...foundation, outputDir: '../../test-results/atomic-auth',
  testMatch: ['atomic-auth-parity.spec.ts', 'atomic-signup-parity.spec.ts', 'atomic-public-routes.spec.ts'],
  fullyParallel: false,
  workers: 1,
  webServer: Array.isArray(foundation.webServer) ? foundation.webServer.slice(0, 2).map((server, index) => ({ ...server, url: server.url?.replace(/:432[01]/, `:${4340 + index}`), env: { ...server.env, PORT: String(4340 + index) } })) : foundation.webServer,
})
