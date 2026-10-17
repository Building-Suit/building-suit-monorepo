import { defineConfig } from '@playwright/test'
import foundation from './playwright.config'
// Execute the existing compatible workspace cases unchanged. The n8n adapter
// suite is explicitly held by the Doctor task's no-n8n constraint; its absence
// remains an unrun obligation, never an aggregate/full-stg PASS.
const servers = Array.isArray(foundation.webServer) ? foundation.webServer : []
if (servers.length!==6) throw new Error('Expected the maintained six-Suit workspace configuration')
export default defineConfig({
  ...foundation,
  testIgnore: 'atomic-automation.spec.ts',
  outputDir: '../../test-results/doctor-workspace',
  reporter: process.env.DOCTOR_WORKSPACE_REPORT ? [['list'],['json',{ outputFile: process.env.DOCTOR_WORKSPACE_REPORT }]] : [['list']],
  // Automation's other shared-shell/settings tests use its local root only.
  // Its maintained blank database/operator settings remain intact.
  webServer: servers.map(server => server.url==='http://127.0.0.1:4324/n8n' ? { ...server,url: 'http://127.0.0.1:4324/' } : server),
})
