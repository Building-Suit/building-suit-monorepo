import { defineConfig } from '@playwright/test'
import { createServer } from 'node:net'
import pilot from '../../packages/testing/playwright.shop-pilot.config'

async function foundationConfig() {
  // Allocate once in the runner; workers inherit the same port when reloading
  // this config. Never reuse a pilot server or another worktree's build.
  if (!process.env.SHOP_FOUNDATION_PORT) {
    process.env.SHOP_FOUNDATION_PORT = await new Promise<string>((resolve, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          server.close(() => reject(new Error('Could not allocate the Shop foundation port')))
          return
        }
        server.close(error => error ? reject(error) : resolve(String(address.port)))
      })
    })
  }
  const port = process.env.SHOP_FOUNDATION_PORT
  const webServer = Array.isArray(pilot.webServer) ? pilot.webServer[0] : pilot.webServer

  return defineConfig({
    ...pilot,
    testMatch: 'shared-ui-foundation.spec.ts',
    workers: 1,
    retries: 0,
    outputDir: '../../test-results/shop-shared-ui',
    use: { ...pilot.use, baseURL: `http://127.0.0.1:${port}` },
    webServer: {
      ...webServer,
      url: `http://127.0.0.1:${port}/auth/login`,
      env: { ...webServer?.env, PORT: port },
      reuseExistingServer: false,
    },
  })
}

export default foundationConfig()
