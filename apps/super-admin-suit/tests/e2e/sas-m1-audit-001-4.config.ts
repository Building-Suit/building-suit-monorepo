import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({ ...base, testMatch: 'sas-m1-audit-001-4.spec.ts' })
