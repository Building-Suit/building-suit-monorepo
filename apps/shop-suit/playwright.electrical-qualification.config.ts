import { defineConfig } from '@playwright/test'
import qualification from './playwright.qualification.config'

// Same maintained fixed disposable backend, with no synthetic API transport.
// Never record real Auth credentials/session material in traces or screenshots.
export default defineConfig({
  ...qualification, testMatch: 'electrical-native.spec.ts', preserveOutput: 'never',
  outputDir: '../../test-results/shop-electrical-native',
  use: { ...qualification.use, trace: 'off', video: 'off', screenshot: 'off' },
})
