import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['schedule-block-detail.spec.ts'], outputDir: '../../../../test-results/schedule-block-detail' })
