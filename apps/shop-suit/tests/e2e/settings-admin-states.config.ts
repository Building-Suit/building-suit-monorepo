import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['settings-admin-states.spec.ts'], outputDir: '../../../../test-results/settings-admin-states' })
