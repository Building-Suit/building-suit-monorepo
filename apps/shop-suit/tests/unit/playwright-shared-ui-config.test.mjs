import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { defineConfig } from '@playwright/test'
import ts from 'typescript'

const source = readFileSync(new URL('../../playwright.shared-ui.config.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const pilot = {
  use: { baseURL: 'http://127.0.0.1:4421', trace: 'retain-on-failure' },
  webServer: {
    command: 'node apps/shop-suit/.output/server/index.mjs',
    cwd: '/fixture',
    url: 'http://127.0.0.1:4421/auth/login',
    env: { PORT: '4421', HOST: '127.0.0.1', APP_ENV: 'local' },
    reuseExistingServer: false,
  },
}

function loadConfig(env, createServer) {
  const exports = {}
  new Function('exports', 'require', 'process', code)(exports, name => {
    if (name === '@playwright/test') return { defineConfig }
    if (name === 'node:net') return { createServer }
    if (name.endsWith('playwright.shop-pilot.config')) return { default: pilot }
    throw new Error(`Unexpected import: ${name}`)
  }, { env })
  return exports.default
}

test('foundation runner and workers use one isolated server without retaining the pilot port', async () => {
  const env = {}
  let closed = false
  const config = await loadConfig(env, () => {
    const server = new EventEmitter()
    server.listen = (port, host, ready) => {
      assert.equal(port, 0)
      assert.equal(host, '127.0.0.1')
      queueMicrotask(ready)
    }
    server.address = () => ({ port: 49123 })
    server.close = done => { closed = true; done() }
    return server
  })
  assert.equal(closed, true)
  assert.equal(env.SHOP_FOUNDATION_PORT, '49123')
  assert.equal(Array.isArray(config.webServer), false)
  assert.equal(config.webServer.url, 'http://127.0.0.1:49123/auth/login')
  assert.equal(config.webServer.env.PORT, '49123')
  assert.equal(config.use.baseURL, 'http://127.0.0.1:49123')
  assert.equal(config.webServer.reuseExistingServer, false)
  assert.equal(config.webServer.command, pilot.webServer.command)
  assert.equal(config.webServer.env.APP_ENV, 'local')
  assert.equal(config.use.trace, 'retain-on-failure')
  assert.equal(pilot.webServer.env.PORT, '4421')

  const worker = await loadConfig({ ...env }, () => { throw new Error('Worker must inherit the runner port') })
  assert.deepEqual(worker.webServer, config.webServer)
  assert.equal(worker.use.baseURL, config.use.baseURL)
})

test('port allocation failure rejects the required check', async () => {
  const error = new Error('listen EPERM')
  const env = {}
  await assert.rejects(loadConfig(env, () => {
    const server = new EventEmitter()
    server.listen = () => queueMicrotask(() => server.emit('error', error))
    return server
  }), error)
  assert.equal(env.SHOP_FOUNDATION_PORT, undefined)
})
