import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['cash-action-recovery.spec.ts'], outputDir: '../../../../test-results/cash-action-recovery' })
