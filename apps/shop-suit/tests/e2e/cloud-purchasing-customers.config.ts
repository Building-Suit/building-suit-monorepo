import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['atomic-purchasing.spec.ts', 'atomic-customers.spec.ts', 'cloud-purchasing-customers.spec.ts'], grep: /en, light, 1440|ar, dark, 390/, grepInvert: /receipt adapter print and share/, outputDir: '../../../../test-results/cloud-purchasing-customers' })
