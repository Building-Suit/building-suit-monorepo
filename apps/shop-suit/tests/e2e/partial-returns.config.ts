import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['partial-returns.spec.ts', 'atomic-commerce-details.spec.ts', 'tax-foundation.spec.ts'], outputDir: '../../../../test-results/partial-returns' })
