import { defineConfig } from '@playwright/test'
import otp from '../../playwright.auth-otp.config'
export default defineConfig({ ...otp, testMatch: ['cloud-public-auth.spec.ts', 'auth-otp.spec.ts', 'public-legal.spec.ts'], grep: /flat public|invalid OTP, refresh|expired drafts recover|Arabic signup is plan-neutral|public\/legal routes|canonical Shop logos|contact validation/, outputDir: '../../../../test-results/cloud-public-auth' })
