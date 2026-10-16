import {defineConfig} from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
export default defineConfig({...atomicShop,testMatch:['appointment-access.spec.ts'],outputDir:'../../../../test-results/appointment-access'})
