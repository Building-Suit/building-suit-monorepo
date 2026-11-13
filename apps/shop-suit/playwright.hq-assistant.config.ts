import { defineConfig } from '@playwright/test'
import assistant from './playwright.assistant.config'

const server = Array.isArray(assistant.webServer) ? assistant.webServer[0] : assistant.webServer
if (!server) throw new Error('Shop assistant fixture server is missing')

export default defineConfig({
  ...assistant,
  testMatch: ['hq-assistant*.spec.ts'],
  outputDir: '../../test-results/shop-hq-assistant',
  webServer: { ...server, env: { ...server.env, NUXT_PUBLIC_SHOP_ASSISTANT_MODE: 'hq' } },
})
