// Isolate the unrelated landing plans request. Changelog browsers still consume
// real anonymous release RPC projections produced by the disposable SQL suite.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function publicChangelogFixtureResponse(method, pathname) {
  if (method === 'POST' && pathname === '/rest/v1/rpc/shop_public_plan_catalog') return { status: 200, body: [] }
  return { status: 404, body: { message: 'Unknown synthetic endpoint' } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const api = createServer((req, res) => {
    const response = publicChangelogFixtureResponse(req.method, new URL(req.url, 'http://127.0.0.1:46943').pathname)
    res.writeHead(response.status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(response.body))
  })
  api.listen(46943, '127.0.0.1', () => {
    const child = spawn(process.execPath, ['apps/shop-suit/.output/server/index.mjs'], {
      stdio: 'inherit', env: {
        ...process.env, PORT: '4393', HOST: '127.0.0.1',
        SUPABASE_URL: 'http://127.0.0.1:46943', NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:46943',
        SUPABASE_KEY: 'local-fixture-publishable-key', NUXT_PUBLIC_SUPABASE_KEY: 'local-fixture-publishable-key',
        NUXT_RELEASE_CATALOG_URL: '', NUXT_RELEASE_CATALOG_PUBLISHABLE_KEY: '',
      },
    })
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { child.kill(signal); api.close() })
    child.on('exit', code => { api.close(); process.exitCode = code ?? 1 })
  })
}
