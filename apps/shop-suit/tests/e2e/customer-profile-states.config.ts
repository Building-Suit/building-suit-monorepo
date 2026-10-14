import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['customer-profile-states.spec.ts'], outputDir: '../../../../test-results/customer-profile-states' })
