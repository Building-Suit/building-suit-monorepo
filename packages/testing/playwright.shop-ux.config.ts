import { defineConfig } from '@playwright/test'
import pilot from './playwright.shop-pilot.config'

export default defineConfig(pilot, {
  testMatch: ['pilot-usability.spec.ts', 'cross-workflow-usability.spec.ts'],
  outputDir: '../../test-results/shop-ux',
})
