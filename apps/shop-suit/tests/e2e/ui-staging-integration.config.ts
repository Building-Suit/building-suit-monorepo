import { defineConfig } from '@playwright/test'
import operational from '../../../../packages/testing/playwright.atomic-shop.config'
import publicPages from './public-states.config'
import layout from './dashboard-layout-readiness.config'

const servers = [operational, publicPages, layout].flatMap(config => Array.isArray(config.webServer) ? config.webServer : config.webServer ? [config.webServer] : [])
export default defineConfig({
  ...operational,
  testMatch: undefined,
  outputDir: '../../../../test-results/ui-staging-integration',
  webServer: servers,
  projects: [
    { name: 'operational', use: operational.use, testMatch: ['team.spec.ts', 'atomic-catalog-import.spec.ts', 'catalog-dialog-create.spec.ts', 'catalog-image-upload.spec.ts', 'schedule-block-detail.spec.ts', 'appointment-actions.spec.ts', 'cash-action-recovery.spec.ts', 'customer-profile-states.spec.ts', 'report-variants.spec.ts', 'schedule-variants.spec.ts', 'settings-admin-states.spec.ts'] },
    { name: 'public-non-landing', use: publicPages.use, testMatch: ['public-states.spec.ts', 'public-legal.spec.ts'], grep: /non-landing contact pending|contact validation|public\/legal routes/ },
    { name: 'dashboard-layout', use: layout.use, testMatch: ['dashboard-layout-readiness.spec.ts'] },
  ],
})
