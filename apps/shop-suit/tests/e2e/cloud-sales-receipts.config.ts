import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['cloud-sales-receipts.spec.ts', 'atomic-commerce-details.spec.ts'], outputDir: '../../../../test-results/cloud-sales-receipts' })
