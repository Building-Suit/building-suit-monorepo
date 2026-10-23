import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['measured-retail.spec.ts', 'electrical-reels.spec.ts'], outputDir: '../../../../test-results/measured-retail', use: { ...atomicShop.use, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } } })
