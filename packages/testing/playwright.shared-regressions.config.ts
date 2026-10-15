import { defineConfig } from '@playwright/test'
import shop from './playwright.atomic-shop.config'
export default defineConfig({
  ...shop,
  testMatch: ['ss-launch-solo-variants-001-2.spec.ts', 'post-unification-regressions.spec.ts', 'tax-foundation.spec.ts', 'service-materials.spec.ts'],
  outputDir: '../../test-results/shared-regressions',
})
