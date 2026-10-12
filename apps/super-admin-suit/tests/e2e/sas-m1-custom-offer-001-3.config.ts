import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({ ...base, testMatch: 'sas-m1-custom-offer-001-3.spec.ts' })
