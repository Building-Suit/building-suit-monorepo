import {defineConfig} from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({...atomicShop,testMatch:['ss-appt-002-settings.spec.ts'],outputDir:'../../../../test-results/public-booking-settings'})
