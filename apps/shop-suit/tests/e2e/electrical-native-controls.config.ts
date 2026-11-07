import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'

export default defineConfig({ ...atomicShop, testMatch: ['electrical-native-controls.spec.ts'], outputDir: '../../../../test-results/electrical-native-controls' })
