import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['schedule-variants.spec.ts'], outputDir: '../../../../test-results/schedule-variants' })
