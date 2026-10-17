// Only owned loopback synthetic services; no provider connection or publication.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createWebsiteLaunchFixture } from '../fixtures/website-launch.mjs'

// Fixed control endpoints stay outside Linux's automatic outbound-client range.
// Earlier browser traffic can otherwise reserve a future port in TIME_WAIT.
export const websiteLaunchApiPorts = Object.freeze({ production: 26931, staging: 26936 })

export async function startWebsiteLaunchFixture({ port = '4341', apiPort = websiteLaunchApiPorts.production, appEntry = 'apps/shop-suit/.output/server/index.mjs', environment = 'production', suffix = '', privateOrigin = 'https://shop.building-suit.com' } = {}) {
  const fixture = createWebsiteLaunchFixture()
  const api = createServer(async (req, res) => {
    try {
      let body = ''
      for await (const part of req) body += part
      const args = JSON.parse(body || '{}'), name = req.url.split('/').at(-1)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(req.url === '/control' ? fixture.control(args) : fixture.rpc(name, args, req.headers)))
    } catch { if (!res.destroyed) { res.statusCode = 500; res.end('{"ok":false}') } }
  })
  await new Promise((resolve, reject) => { api.once('error', reject); api.listen(apiPort, '127.0.0.1', resolve) })
  const boundApiPort = api.address().port
  const child = spawn(process.execPath, [appEntry], {
    stdio: 'inherit', env: {
      ...process.env, HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_APP_URL: privateOrigin,
      NUXT_PUBLIC_APP_ENVIRONMENT: environment, NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX: suffix,
      NUXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${boundApiPort}`, SUPABASE_URL: `http://127.0.0.1:${boundApiPort}`,
      NUXT_PUBLIC_SUPABASE_KEY: 'local-fixture-publishable-key', NUXT_RELEASE_CATALOG_URL: '', NUXT_RELEASE_CATALOG_PUBLISHABLE_KEY: '',
    },
  })
  let stopping
  const stop = () => stopping ??= (async () => {
    const closed = new Promise(resolve => api.close(resolve))
    api.closeAllConnections()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve))
      child.kill('SIGTERM')
      const deadline = setTimeout(() => child.kill('SIGKILL'), 3000)
      deadline.unref()
      await exited
      clearTimeout(deadline)
    }
    await closed
  })()
  child.once('exit', () => { void stop() })
  return { apiPort: boundApiPort, child, stop }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const running = await startWebsiteLaunchFixture({ port: process.env.LAUNCH_TEST_PORT, apiPort: Number(process.env.LAUNCH_TEST_API_PORT ?? websiteLaunchApiPorts.production), environment: process.env.LAUNCH_ENVIRONMENT, suffix: process.env.LAUNCH_WEBSITE_SUFFIX, privateOrigin: process.env.LAUNCH_PRIVATE_ORIGIN })
    let requested = false
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { requested = true; void running.stop() })
    running.child.once('exit', code => { void running.stop().then(() => { process.exitCode = requested ? 0 : code ?? 1 }) })
  } catch (error) {
    console.error(error?.code === 'EADDRINUSE' ? 'Website launch fixture: owned API port unavailable' : 'Website launch fixture: startup failed; raw error omitted')
    process.exitCode = 1
  }
}
