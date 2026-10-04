import { defineConfig } from '@playwright/test'
import qualification from './playwright.qualification.config'

// Inherits the fixed local Auth server, disposable acknowledgement and disabled
// credential-bearing traces. Discovery never starts the server or accesses DBs.
export default defineConfig(qualification, {
  testMatch: 'market-qualification.spec.ts', timeout: 180_000,
  outputDir: '../../test-results/shop-market',
})
