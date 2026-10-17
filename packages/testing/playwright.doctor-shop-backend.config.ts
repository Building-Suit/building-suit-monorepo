import { defineConfig } from '@playwright/test'
import backend from './playwright.atomic-backend.config'
// Retain the existing actual signup/persistence/cross-product assertions.
// Generated local Auth material must never enter browser traces or artifacts.
export default defineConfig({
  ...backend,
  preserveOutput: 'never',
  outputDir: process.env.DOCTOR_SHOP_BACKEND_RESULTS || '../../test-results/doctor-shop-backend',
  use: { ...backend.use,trace: 'off',screenshot: 'off',video: 'off' },
})
