import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'

// Resolve the real installed consumers used by Nuxt's tooling.
const rootRequire = createRequire(new URL('../../package.json', import.meta.url))
const eslintRequire = createRequire(rootRequire.resolve('@nuxt/eslint'))
const inspectorRequire = createRequire(eslintRequire.resolve('@eslint/config-inspector/package.json'))
const agenticRequire = createRequire(inspectorRequire.resolve('@devframes/agentic'))
const { StreamableHTTPClientTransport } = agenticRequire('@modelcontextprotocol/client')
const kitRequire = createRequire(eslintRequire.resolve('@nuxt/devtools-kit'))
const viteRequire = createRequire(kitRequire.resolve('vite/package.json'))
const postcssRequire = createRequire(viteRequire.resolve('postcss/package.json'))
const { SourceMapConsumer } = postcssRequire('source-map-js')
const flat = { version: 3, sources: ['fixture.js'], names: [], mappings: 'AAAA' }
const indexed = (line, map = flat, column = 0) => ({ version: 3, sections: [{ offset: { line, column }, map }] })

test('PostCSS source maps preserve ordinary positions and reject amplification offsets', () => {
  const ordinary = new SourceMapConsumer(flat)
  assert.deepEqual(ordinary.originalPositionFor({ line: 1, column: 0 }), { source: 'fixture.js', line: 1, column: 0, name: null })
  for (const map of [indexed(1e9), indexed(6e6, indexed(6e6)), indexed(-1), indexed(0, flat, 0.5)]) {
    assert.throws(() => new SourceMapConsumer(map), /offset.*(integer|exceed)/i)
  }
})

async function server(t, handler) {
  const instance = createServer(handler)
  instance.listen(0, '127.0.0.1')
  await once(instance, 'listening')
  t.after(() => new Promise(resolve => {
    instance.close(resolve)
    instance.closeAllConnections()
  }))
  return `http://127.0.0.1:${instance.address().port}`
}
const message = { jsonrpc: '2.0', method: 'notifications/fixture', params: { synthetic: 'private-body' } }

test('MCP client follows a same-origin redirect and retains the valid request', async (t) => {
  let received
  const origin = await server(t, async (request, response) => {
    if (request.url === '/start') { response.writeHead(307, { location: '/accepted' }); response.end(); return }
    let body = ''
    for await (const chunk of request) body += chunk
    received = { header: request.headers['x-fixture-secret'], body: JSON.parse(body) }
    response.writeHead(202); response.end()
  })
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/start`), { requestInit: { headers: { 'x-fixture-secret': 'synthetic-secret' } } })
  t.after(() => transport.close())
  await transport.start()
  await transport.send(message)
  assert.deepEqual(received, { header: 'synthetic-secret', body: message })
})

test('MCP client refuses cross-origin redirection before leaking custom headers or bodies', async (t) => {
  const leaked = []
  const other = await server(t, async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    leaked.push({ header: request.headers['x-fixture-secret'], body })
    response.writeHead(202); response.end()
  })
  const origin = await server(t, (_request, response) => { response.writeHead(307, { location: `${other}/capture` }); response.end() })
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/start`), { requestInit: { headers: { 'x-fixture-secret': 'synthetic-secret' } } })
  t.after(() => transport.close())
  await transport.start()
  await assert.rejects(transport.send(message), /redirect|origin/i)
  assert.deepEqual(leaked, [])
})
