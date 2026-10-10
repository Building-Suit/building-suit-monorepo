import { defineConfig } from '@playwright/test'
import publicLegal from '../../playwright.public-legal.config'

export default defineConfig(publicLegal, {
  testMatch: 'ss-launch-legal-audit-001-1.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../../../test-results/ss-launch-legal-audit-001',
})
