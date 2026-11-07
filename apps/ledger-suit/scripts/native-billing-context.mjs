import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
export function writePrivate(file, value) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  chmodSync(file, 0o600)
}
export function billingProfile() {
  assert.equal(process.env.LEDGER_BILLING_DISPOSABLE_TEST, '1', 'Explicit local test opt-in required')
  const directory = path.join(root, '.local/verification/billing')
  const owner = readJson(path.join(directory, 'owned-test-project.json'))
  assert.equal(owner.task, 'LS-BILL-NATIVE-001')
  assert.equal(owner.project, 'ledger-billing-20261025')
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  for (const [field, port] of Object.entries({ database_port: 60822, api_port: 60821, mail_port: 60824, ui_port: 60830 })) assert.equal(owner[field], port)
  const config = readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8')
  assert.match(config, /^project_id = "ledger-billing-20261025"$/m)
  const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local' }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
  const docker = (args, options = {}) => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { cwd: root, env, encoding: 'utf8', timeout: 60_000, stdio: 'pipe', ...options })
  return { directory, owner, config, env, docker }
}
export function billingContext() {
  const profile = billingProfile()
  const { directory, owner, env, docker } = profile
  const credentials = readJson(path.join(directory, 'test-credentials.json'))
  for (const [suffix, property] of [['JWT_SECRET', 'jwt'], ['ANON_KEY', 'anon'], ['SERVICE_KEY', 'service']]) env[`LEDGER_BILLING_${suffix}`] = credentials[property]
  const database = `supabase_db_${owner.project}`
  const info = JSON.parse(docker(['inspect', database]))[0]
  assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
  assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(item => item.HostPort === '60822'))
  const psql = (input, variables = {}) => docker(['exec', '-i', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-f', '-', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', ...Object.entries(variables).flatMap(([name, value]) => ['-v', `${name}=${value}`])], { input }).trim()
  return { ...profile, credentials, database, info, psql, url: 'http://127.0.0.1:60821' }
}
