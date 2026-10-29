// Local disposable runtime only. Credentials stay in the owned ignored folder.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { closeSync, existsSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_RECOVERY_DISPOSABLE_TEST, '1', 'Explicit recovery-test opt-in required')
const [role, action] = process.argv.slice(2)
assert.ok(['source', 'target'].includes(role))
assert.ok(['start', 'stop'].includes(action))
assert.equal(process.argv.length, 4, 'Accepts only role and action, never a connection URL')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const directory = path.join(root, '.local/verification/recovery', role)
const marker = path.join(directory, 'owned-test-project.json')
const owner = JSON.parse(readFileSync(marker, 'utf8'))
assert.equal(owner.task, 'LS-OPS-RECOVERY-001')
assert.equal(owner.project, `ledger-recovery-${role}-20261023`)
assert.equal(realpathSync(owner.workdir), realpathSync(directory))
const config = readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8')
assert.ok(config.includes(`project_id = "${owner.project}"`))
const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local' }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
const docker = args => spawnSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, encoding: 'utf8' })
assert.equal(docker(['info', '--format', '{{.ServerVersion}}']).status, 0, 'Managed local Docker socket unavailable')
const preparedAt = Math.floor(statSync(marker).birthtimeMs / 1000)
assert.ok(preparedAt > 0, 'Cannot establish when the owned project was prepared')
for (const kind of ['db', 'storage']) {
  const found = docker(['volume', 'inspect', `supabase_${kind}_${owner.project}`])
  if (found.status === 0) {
    const volume = JSON.parse(found.stdout)[0]
    assert.equal(volume.Labels?.['com.supabase.cli.project'], owner.project)
    assert.ok(Math.floor(Date.parse(volume.CreatedAt) / 1000) >= preparedAt,
      'A volume predates this owned project marker; inspect it instead of adopting another task\'s data')
  } else assert.match(found.stderr, /no such volume|No such volume/, 'Unexpected volume lookup failure')
}
const inspected = docker(['inspect', `supabase_db_${owner.project}`])
if (inspected.status === 0) {
  const database = JSON.parse(inspected.stdout)[0]
  assert.equal(realpathSync(database.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
} else assert.match(inspected.stderr, /No such (object|container)/, 'Unexpected container lookup failure')
const credentialsPath = path.join(directory, 'test-credentials.json')
if (!existsSync(credentialsPath)) {
  assert.equal(action, 'start')
  const jwt = randomBytes(48).toString('base64url')
  const token = role => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 })).toString('base64url')
    return `${header}.${payload}.${createHmac('sha256', jwt).update(`${header}.${payload}`).digest('base64url')}`
  }
  writeFileSync(credentialsPath, `${JSON.stringify({ jwt, anon: token('anon'), service: token('service_role') })}\n`, { mode: 0o600, flag: 'wx' })
}
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'))
for (const [suffix, property] of [['JWT_SECRET', 'jwt'], ['ANON_KEY', 'anon'], ['SERVICE_KEY', 'service']]) {
  const key = `LEDGER_RECOVERY_${role.toUpperCase()}_${suffix}`
  assert.ok(config.includes(`env(${key})`), 'Copied configuration does not bind the private test credential')
  env[key] = credentials[property]
}
const log = path.join(directory, `${action}.log`)
const output = openSync(log, 'w', 0o600)
try {
  const args = ['--workdir', directory, action]
  // Alpine wget health checks ignore proxy exemptions in this managed runtime.
  // Verify the actual owned endpoints below; do not infer health from CLI exit.
  if (action === 'start') args.push('--ignore-health-check', '-x', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor')
  const result = spawnSync('pnpm', ['exec', 'supabase', ...args], { cwd: root, env, stdio: ['ignore', output, output], timeout: 300_000 })
  assert.equal(result.status, 0, `Owned ${role} ${action} failed; inspect its private runtime log without printing credentials`)
} finally { closeSync(output) }
if (action === 'start') {
  const port = role === 'source' ? 60621 : 60721
  for (const route of ['/auth/v1/health', '/storage/v1/status', '/rest-admin/v1/ready']) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { headers: { apikey: credentials.anon } })
    assert.equal(response.status, 200, `Actual owned provider endpoint is unhealthy: ${route}`)
  }
}
console.log(JSON.stringify({ role, project: owner.project, action, result: 'pass', log: path.relative(root, log) }))
