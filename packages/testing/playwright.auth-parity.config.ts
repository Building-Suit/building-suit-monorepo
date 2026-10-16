import { defineConfig } from '@playwright/test'
import settings from './playwright.settings-focus.config'

export default defineConfig({
  ...settings,
  testMatch: ['atomic-auth-parity.spec.ts', 'atomic-signup-parity.spec.ts', 'atomic-public-routes.spec.ts'],
  outputDir: '../../test-results/auth-parity',
})
