import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({
  ...base,
  testMatch: 'sas-m1-instapay-001-3.spec.ts',
  webServer: {
    ...base.webServer,
    command: 'node .output/server/index.mjs',
    env: { PORT: '4324', HOST: '127.0.0.1', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:64321', NUXT_PUBLIC_SUPABASE_KEY: 'local-browser-test-key', NUXT_SUPABASE_SERVICE_KEY: 'sas-adapter-server-only-sentinel-DO-NOT-EXPOSE' },
  },
})
