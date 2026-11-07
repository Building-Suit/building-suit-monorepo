// Own disposable project only. Stop preserves its volumes; no reset/delete path.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { closeSync, existsSync, openSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { billingProfile, readJson, root, writePrivate } from './native-billing-context.mjs'

const action = process.argv[2]
assert.ok(['start', 'stop'].includes(action))
assert.equal(process.argv.length, 3, 'Accepts only action; never connection URLs')
const { directory, owner, config, env, docker } = billingProfile()
docker(['info', '--format', '{{.ServerVersion}}'])
const preparedAt = Math.floor(statSync(path.join(directory, 'owned-test-project.json')).birthtimeMs / 1000)
assert.ok(preparedAt > 0)
for (const kind of ['db', 'storage']) {
  let raw
  try { raw = docker(['volume', 'inspect', `supabase_${kind}_${owner.project}`]) }
  catch (error) { assert.match(String(error.stderr), /no such volume|No such volume/); continue }
  const volume = JSON.parse(raw)[0]
  assert.equal(volume.Labels?.['com.supabase.cli.project'], owner.project)
  assert.ok(Math.floor(Date.parse(volume.CreatedAt) / 1000) >= preparedAt, 'Refuse to adopt a volume older than this owned profile')
}
let container
try { container = JSON.parse(docker(['inspect', `supabase_db_${owner.project}`]))[0] }
catch (error) { assert.match(String(error.stderr), /No such (object|container)/) }
if (container) assert.equal(realpathSync(container.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
const file = path.join(directory, 'test-credentials.json')
if (!existsSync(file)) {
  assert.equal(action, 'start')
  const jwt = randomBytes(48).toString('base64url')
  const token = role => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 })).toString('base64url')
    return `${header}.${payload}.${createHmac('sha256', jwt).update(`${header}.${payload}`).digest('base64url')}`
  }
  writePrivate(file, { jwt, anon: token('anon'), service: token('service_role') })
}
const credentials = readJson(file)
for (const [suffix, property] of [['JWT_SECRET', 'jwt'], ['ANON_KEY', 'anon'], ['SERVICE_KEY', 'service']]) {
  assert.ok(config.includes(`env(LEDGER_BILLING_${suffix})`))
  env[`LEDGER_BILLING_${suffix}`] = credentials[property]
}
const log = path.join(directory, `${action}.log`)
const output = openSync(log, 'w', 0o600)
try {
  const args = ['exec', 'supabase', '--workdir', directory, action]
  // The platform proxy breaks Alpine wget health checks; actual HTTP checked below.
  if (action === 'start') args.push('--ignore-health-check', '-x', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor')
  const result = spawnSync('pnpm', args, { cwd: root, env, stdio: ['ignore', output, output], timeout: 300_000 })
  assert.equal(result.status, 0, 'Inspect owned private runtime log; it may contain keys')
} finally { closeSync(output) }
if (action === 'start') for (const route of ['/auth/v1/health', '/storage/v1/status', '/rest-admin/v1/ready']) {
  let status
  for (let attempt = 0; attempt < 30; attempt++) {
    try { status = (await fetch(`http://127.0.0.1:60821${route}`, { headers: { apikey: credentials.anon }, signal: AbortSignal.timeout(2000) })).status }
    catch { status = 'unreachable' }
    if (status === 200) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(status, 200, `Owned actual provider endpoint not ready: ${route}`)
}
console.log(JSON.stringify({ project: owner.project, action, result: 'pass', retained_volumes: true }))
