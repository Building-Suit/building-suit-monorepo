import { defineConfig } from '@playwright/test'
import xpay from './playwright.xpay.config'
export default defineConfig({ ...xpay, testMatch: ['proration-checkout.spec.ts', 'proration-recovery.spec.ts'], outputDir: '../../test-results/shop-proration' })
