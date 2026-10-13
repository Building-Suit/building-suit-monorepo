import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['cloud-inventory-states.spec.ts', 'atomic-stock-expenses.spec.ts'], grep: /inventory/, outputDir: '../../../../test-results/cloud-inventory-states' })
