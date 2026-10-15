import { defineConfig } from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({...atomicShop,testMatch:['eta-submission.spec.ts'],outputDir:'../../../../test-results/eta-submission'})
