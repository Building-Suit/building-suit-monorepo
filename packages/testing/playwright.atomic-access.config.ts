import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
export default defineConfig({ ...foundation, outputDir: '../../test-results/atomic-access', testMatch: ['atomic-access-parity.spec.ts', 'dialog-discard-focus.spec.ts', 'atomic-template-catalogue.spec.ts'], fullyParallel: false, workers: 1, webServer: Array.isArray(foundation.webServer) ? foundation.webServer.slice(2, 3) : foundation.webServer })
