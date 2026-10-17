import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startWebsiteLaunchFixture, websiteLaunchApiPorts } from '../e2e/website-launch-fixture-server.mjs'

async function listen(server, port = 0) { server.listen(port, '127.0.0.1'); await once(server, 'listening'); return server.address().port }
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
async function reusable(port) { const server = createServer(); try { assert.equal(await listen(server, port), port) } finally { await close(server) } }

test('fixed launch control ports stay below the operating system outbound ephemeral range', async () => {
  let lowerBound = 32768
  if (process.platform === 'linux') lowerBound = Number((await readFile('/proc/sys/net/ipv4/ip_local_port_range', 'utf8')).trim().split(/\s+/)[0])
  for (const port of Object.values(websiteLaunchApiPorts)) assert.ok(port > 1024 && port < lowerBound)
  assert.notEqual(websiteLaunchApiPorts.production, websiteLaunchApiPorts.staging)
})

test('awaited fixture shutdown closes incomplete API requests and its actual child before ports are reused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-launch-lifecycle-'))
  try {
    for (let index = 0; index < 2; index++) {
      const ready = join(directory, `ready-${index}.json`), entry = join(directory, `app-${index}.mjs`)
      await writeFile(entry, `import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';const server=createServer((_req,res)=>res.end('synthetic app'));server.listen(Number(process.env.PORT),'127.0.0.1',()=>writeFileSync(${JSON.stringify(ready)},JSON.stringify({port:server.address().port})));`)
      const running = await startWebsiteLaunchFixture({ port: 0, apiPort: 0, appEntry: entry })
      try {
        let appPort;const deadline = Date.now() + 5000
        while (!appPort) { try { appPort = JSON.parse(await readFile(ready, 'utf8')).port } catch { assert.ok(Date.now() < deadline, 'Owned child becomes ready'); await new Promise(resolve => setTimeout(resolve, 10)) } }
        assert.equal(await (await fetch(`http://127.0.0.1:${appPort}`)).text(), 'synthetic app')
        const socket = connect({ host: '127.0.0.1', port: running.apiPort });socket.on('error', () => {})
        await once(socket, 'connect');socket.write('POST /control HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\n\r\n{')
        const disconnected = new Promise(resolve => socket.once('close', resolve))
        await Promise.all([running.stop(), running.stop(), disconnected])
        assert.ok(running.child.exitCode !== null || running.child.signalCode !== null)
        await reusable(running.apiPort);await reusable(appPort)
      } finally { await running.stop() }
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('an occupied API endpoint fails without reusing or terminating another listener', async () => {
  const foreign = createServer((_req, res) => res.end('foreign listener'))
  const port = await listen(foreign)
  try {
    await assert.rejects(startWebsiteLaunchFixture({ apiPort: port }), { code: 'EADDRINUSE' })
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'foreign listener')
  } finally { await close(foreign) }
})
