import { defineConfig } from '@playwright/test'
import cashPolicy from './ss-launch-cash-policy-001-2.config'
// One production build and one synthetic transport; never calls hosted services.
export default defineConfig({
  ...cashPolicy,
  testMatch: ['ss-launch-realtime-001-1.spec.ts', 'team.spec.ts', 'ss-launch-cash-policy-001-2.spec.ts', 'ss-launch-fast-pay-001-2.spec.ts', 'ss-launch-pos-customer-001-1.spec.ts', 'ss-launch-sale-copy-001-2.spec.ts', 'ss-launch-solo-variants-001-2.spec.ts', 'private-offer-entry.spec.ts', 'ss-launch-support-001-3.spec.ts', 'ss-launch-legal-audit-001-1.spec.ts'],
  workers: 1, retries: 0,
  outputDir: '../../../../test-results/shop-release-regression',
  webServer: (Array.isArray(cashPolicy.webServer) ? cashPolicy.webServer : [cashPolicy.webServer]).map(server => ({ ...server, command: 'node apps/shop-suit/tests/e2e/cash-policy-fixture-server.mjs' })),
})
