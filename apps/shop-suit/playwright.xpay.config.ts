import { defineConfig } from '@playwright/test'
import pilot from '../../packages/testing/playwright.shop-pilot.config'
export default defineConfig(pilot, {
  testMatch: ['xpay-billing.spec.ts', 'atomic-billing.spec.ts', 'plan-owner.spec.ts', 'private-offer-entry.spec.ts', 'ss-launch-solo-variants-001-2.spec.ts'], workers: 1, retries: 0, outputDir: '../../test-results/shop-xpay',
  use: { ...pilot.use, baseURL: 'http://127.0.0.1:4326' },
  webServer: { ...pilot.webServer, command: 'node apps/shop-suit/tests/e2e/cash-policy-fixture-server.mjs', url: 'http://127.0.0.1:4326/auth/login', reuseExistingServer: false,
    env: { APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:46421', NUXT_PUBLIC_SUPABASE_KEY: 'local-ui-test-key' } },
})
