import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'

export default defineConfig({ ...atomicShop, testMatch: ['native-pilot-login.spec.ts'], outputDir: '../../../../test-results/native-pilot-login' })
