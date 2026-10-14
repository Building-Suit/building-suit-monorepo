import { defineConfig } from '@playwright/test'
import otp from '../../playwright.auth-otp.config'
export default defineConfig({ ...otp, testMatch: ['public-states.spec.ts', 'public-legal.spec.ts'], grep: /non-landing|contact validation|public\/legal routes/, outputDir: '../../../../test-results/public-states' })
