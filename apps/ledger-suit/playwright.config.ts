import { defineConfig, devices } from '@playwright/test'

if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'http://127.0.0.1:60321') throw new Error('Ledger write tests require the isolated monorepo local backend')

const port = process.env.PLAYWRIGHT_PORT ?? '3210'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: !process.env.CI,
    env: {
      APP_ENV: 'local', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-ledger-local-auth-token',
      PORT: port, HOST: '127.0.0.1',
      NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:60321',
      NUXT_PUBLIC_SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:60321',
      SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
  },
})
