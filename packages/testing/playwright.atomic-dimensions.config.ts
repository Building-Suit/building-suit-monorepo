import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
export default defineConfig({ ...foundation, testDir: '../../apps/ledger-suit/tests/e2e', testMatch: 'accounting-dimensions.spec.ts', fullyParallel: false, workers: 1, use: { ...foundation.use, baseURL: 'http://127.0.0.1:4320' }, webServer: Array.isArray(foundation.webServer) ? foundation.webServer.slice(0, 1) : foundation.webServer })
