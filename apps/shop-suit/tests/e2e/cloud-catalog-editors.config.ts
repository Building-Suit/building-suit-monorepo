import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['atomic-catalogue.spec.ts', 'catalog-image-upload.spec.ts'], outputDir: '../../../../test-results/cloud-catalog-editors' })
