import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['penpot-dashboard.spec.ts'], outputDir: '../../../../test-results/penpot-dashboard' })
