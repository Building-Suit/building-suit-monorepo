import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['atomic-appointments.spec.ts', 'atomic-operations.spec.ts', 'atomic-stock-expenses.spec.ts', 'atomic-reports.spec.ts', 'cloud-daily-operations.spec.ts'], grep: /en, light, 1440|ar, dark, 390/, grepInvert: /inventory count|business settings/, outputDir: '../../../../test-results/cloud-daily-operations' })
