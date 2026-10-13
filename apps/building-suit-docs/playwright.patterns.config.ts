import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0, fullyParallel: false,
  outputDir: './test-results/patterns', reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4392', screenshot: 'only-on-failure' },
  webServer: { command: 'node .output/server/index.mjs', url: 'http://127.0.0.1:4392/components', reuseExistingServer: false, env: { PORT: '4392', HOST: '127.0.0.1' } },
})
