import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({ ...atomicShop, testMatch: ['penpot-shell.spec.ts'], outputDir: '../../../../test-results/penpot-shell' })
