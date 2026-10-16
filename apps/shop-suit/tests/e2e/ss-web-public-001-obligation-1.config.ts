import {defineConfig} from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({...atomicShop,testMatch:['ss-web-public-001-obligation-1.spec.ts'],outputDir:'../../../../test-results/website-inquiries',use:{...atomicShop.use,launchOptions:process.env.WEBSITE_TEST_CHROMIUM?{executablePath:process.env.WEBSITE_TEST_CHROMIUM}:undefined}})
