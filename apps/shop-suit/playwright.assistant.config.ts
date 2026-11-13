import { defineConfig } from '@playwright/test'
import shop from '../../packages/testing/playwright.atomic-shop.config'

const server = Array.isArray(shop.webServer) ? shop.webServer[0] : shop.webServer
if (!server) throw new Error('Shop assistant fixture server is missing')

export default defineConfig({
  ...shop,
  testMatch: 'assistant-chat.spec.ts',
  outputDir: '../../test-results/shop-assistant',
  webServer: { ...server, env: { ...server.env, NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED: 'true' } },
})
