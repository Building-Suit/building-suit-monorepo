import { defineConfig } from '@playwright/test'
import financial from './playwright.acceptance.config'

export default defineConfig({
  ...financial,
  testMatch: ['shared-ui-foundation.spec.ts'],
  outputDir: '../../test-results/journal-money-compat',
})
