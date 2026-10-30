// Native framework regression. Only an owned synthetic loopback app is built.
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { closeSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import path from 'node:path'

assert.equal(process.env.NUXT_ROUTE_SECURITY_DISPOSABLE, '1', 'Explicit synthetic framework-test opt-in required')
const mode = process.argv[2]
assert.ok(['baseline', 'verify'].includes(mode))
assert.equal(process.argv.length, 3, 'Accepts no URL, project or credential')
const root = realpathSync(process.cwd())
assert.equal(realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()), root)
assert.equal(JSON.parse(readFileSync(path.join(root, 'package.json'))).name, 'building-suit-monorepo')
const require = createRequire(path.join(root, 'package.json'))
const packageFile = require.resolve('nuxt/package.json')
const framework = JSON.parse(readFileSync(packageFile))
const cli = path.join(path.dirname(packageFile), 'bin/nuxt.mjs')
const directory = path.join(root, '.local/verification', `nuxt-route-security-${Date.now()}-${randomUUID()}`)
mkdirSync(path.join(directory, 'app/pages'), { recursive: true, mode: 0o700 })
const files = {
  'nuxt.config.mjs': `export default { compatibilityDate: '2026-08-30', telemetry: false, devtools: { enabled: false }, nitro: { preset: 'node-server' }, routeRules: { '/protected': { redirect: '/login', headers: { 'x-fixture-guard': 'applied' } } } }\n`,
  'app/app.vue': '<template><NuxtPage /></template>\n',
  'app/pages/login.vue': '<template><h1>Synthetic public sign-in</h1></template>\n',
  'app/pages/protected.vue': '<template><h1>Synthetic protected material</h1></template>\n',
}
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(directory, name), content, { mode: 0o600, flag: 'wx' })
writeFileSync(path.join(directory, 'owned-test.json'), JSON.stringify({ task: 'LS-SEC-DEP-003', kind: 'synthetic framework only', mode, framework: framework.version }), { mode: 0o600, flag: 'wx' })
const env = { ...process.env, NUXT_TELEMETRY_DISABLED: '1' }
const started = Date.now()
const buildLog = openSync(path.join(directory, 'build.log'), 'wx', 0o600)
try {
  const built = spawnSync(process.execPath, [cli, 'build', directory], { cwd: root, env, stdio: ['ignore', buildLog, buildLog], timeout: 180_000 })
  assert.equal(built.status, 0, 'Synthetic Nuxt build failed; inspect its owned private build log')
} finally { closeSync(buildLog) }
const buildMs = Date.now() - started
const socket = createServer()
socket.listen(0, '127.0.0.1')
await once(socket, 'listening')
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const runtimeLog = openSync(path.join(directory, 'runtime.log'), 'wx', 0o600)
const server = spawn(process.execPath, [path.join(directory, '.output/server/index.mjs')], {
  cwd: directory, env: { ...env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', runtimeLog, runtimeLog],
})
const origin = `http://127.0.0.1:${port}`
try {
  let login
  for (let attempt = 0; attempt < 100 && !login; attempt++) {
    assert.equal(server.exitCode, null, 'Owned framework server exited before readiness')
    try { login = await fetch(`${origin}/login`, { redirect: 'manual', signal: AbortSignal.timeout(2000) }) }
    catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  assert.equal(login?.status, 200)
  assert.match(await login.text(), /Synthetic public sign-in/)
  const inspect = async route => {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    const body = await response.text()
    return { status: response.status, location: response.headers.get('location'), guard_header: response.headers.get('x-fixture-guard'), protected_material: body.includes('Synthetic protected material') }
  }
  const lower = await inspect('/protected')
  const variant = await inspect('/PROTECTED')
  const guarded = response => [301, 302, 303, 307, 308].includes(response.status) && response.location === '/login' && response.guard_header === 'applied' && !response.protected_material
  assert.equal(guarded(lower), true, 'Ordinary route must apply its redirect')
  if (mode === 'baseline') {
    assert.equal(variant.status, 200)
    assert.equal(variant.protected_material, true, 'Expected pre-fix case-variant bypass was not reproduced')
  } else assert.equal(guarded(variant), true, 'Case-variant path bypassed the server route rule')
  const evidence = { task: 'LS-SEC-DEP-003', mode, framework: framework.version, result: mode === 'baseline' ? 'vulnerability_reproduced' : 'pass',
    login_status: login.status, lower, case_variant: variant, build_ms: buildMs, elapsed_ms: Date.now() - started,
    source_sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), boundary: 'Owned synthetic app, real Nuxt production build and loopback HTTP; no product database or provider used.' }
  writeFileSync(path.join(directory, 'result.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ ...evidence, evidence: path.relative(root, path.join(directory, 'result.json')) }))
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit')
    server.kill('SIGTERM')
    await stopped
  }
  closeSync(runtimeLog)
}
