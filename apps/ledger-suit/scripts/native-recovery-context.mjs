// Shared operator context for the two fixed, owned disposable local projects.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
export function writePrivate(file, value) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}
export function artifact(file) {
  return { path: path.relative(root, file), bytes: statSync(file).size, sha256: digest(readFileSync(file)) }
}
export function recoveryContext(role) {
  assert.equal(process.env.LEDGER_RECOVERY_DISPOSABLE_TEST, '1', 'Explicit recovery-test opt-in required')
  assert.ok(['source', 'target'].includes(role))
  const directory = path.join(root, '.local/verification/recovery', role)
  const owner = readJson(path.join(directory, 'owned-test-project.json'))
  assert.equal(owner.task, 'LS-OPS-RECOVERY-001')
  assert.equal(owner.project, `ledger-recovery-${role}-20261023`)
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  const credentials = readJson(path.join(directory, 'test-credentials.json'))
  const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local' }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
  for (const [suffix, property] of [['JWT_SECRET', 'jwt'], ['ANON_KEY', 'anon'], ['SERVICE_KEY', 'service']]) env[`LEDGER_RECOVERY_${role.toUpperCase()}_${suffix}`] = credentials[property]
  const docker = (args, options = {}) => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { cwd: root, env, stdio: 'pipe', encoding: 'utf8', timeout: 60_000, ...options })
  const database = `supabase_db_${owner.project}`
  const info = JSON.parse(docker(['inspect', database]))[0]
  assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
  assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(item => item.HostPort === String(owner.database_port)))
  const sql = query => docker(['exec', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-c', query]).trim()
  const psql = (input, variables = {}, operator = 'postgres') => {
    assert.ok(['postgres', 'supabase_admin'].includes(operator), 'Only the existing owned local operator roles are allowed')
    return docker(['exec', '-i', database, 'psql', '-X', '-U', operator, '-d', 'postgres', '-Atq', '-f', '-', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
      ...Object.entries(variables).flatMap(([key, value]) => ['-v', `${key}=${value}`])], { input })
  }
  const cli = (args, log) => {
    const start = Date.now()
    const result = spawnSync('pnpm', ['exec', 'supabase', '--workdir', directory, ...args], { cwd: root, env, encoding: 'utf8', timeout: 180_000 })
    writePrivate(log, (result.stdout || '') + (result.stderr || ''))
    assert.equal(result.status, 0, `Owned ${role} CLI operation failed; inspect its private log`)
    return { elapsed_ms: Date.now() - start, exit_code: result.status }
  }
  return { role, directory, owner, database, info, env, credentials, docker, sql, psql, cli,
    url: `http://127.0.0.1:${role === 'source' ? 60621 : 60721}` }
}
