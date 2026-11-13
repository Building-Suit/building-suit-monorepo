import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'

export default defineConfig({ ...atomicShop, testMatch: ['catalog-capacity.spec.ts'], outputDir: '../../../../test-results/catalog-capacity' })
