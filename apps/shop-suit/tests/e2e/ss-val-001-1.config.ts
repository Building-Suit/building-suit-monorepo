import { defineConfig } from '@playwright/test'
import cashPolicy from './ss-launch-cash-policy-001-2.config'

// These operational suites share the same local synthetic SSR transport.
// Provider-backed authorization and trigger behavior remain separate SQL gates.
export default defineConfig(cashPolicy, {
  testMatch: 'ss-val-001-1.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../../../test-results/ss-val-001',
})
