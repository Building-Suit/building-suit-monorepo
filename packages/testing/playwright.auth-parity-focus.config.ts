import { defineConfig } from '@playwright/test'
import workspace from './playwright.config'
const servers = Array.isArray(workspace.webServer) ? workspace.webServer.slice(0, 2) : []
export default defineConfig({ ...workspace, testMatch: ['atomic-auth-parity.spec.ts'], workers: 1, webServer: servers, outputDir: '../../test-results/auth-parity-focus' })
