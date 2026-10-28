// Fixed owned native browser backend. Start/stop retain financial volumes.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
// Reuse only an explicitly selected, already owned fixture; never copy/reset its data.
const retainedDirectory = process.env.LEDGER_BROWSER_FIXTURE_DIRECTORY
export const directory = retainedDirectory ? realpathSync(retainedDirectory) : path.join(root, '.local/verification/browser')
export const project = 'ledger-browser-20261026'
const source = path.join(root, 'apps/ledger-suit/supabase')
const read = name => JSON.parse(readFileSync(path.join(directory, name), 'utf8'))
export const privateResult = (name, value) => writeFileSync(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
export function browserContext(requireDatabase = true) {
  assert.equal(process.env.LEDGER_BROWSER_DISPOSABLE_TEST, '1')
  const owner = read('owned-test-project.json')
  assert.equal(owner.task, 'LS-BROWSER-001'); assert.equal(owner.project, project)
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  assert.equal(owner.database_port, 61022); assert.equal(owner.api_port, 61021); assert.equal(owner.ui_port, 61030)
  assert.match(readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8'), /^project_id = "ledger-browser-20261026"$/m)
  const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local' }
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[name]
  const credentials = read('test-credentials.json')
  for (const [suffix, field] of [['JWT_SECRET', 'jwt'], ['ANON_KEY', 'anon'], ['SERVICE_KEY', 'service']]) env['LEDGER_BROWSER_' + suffix] = credentials[field]
  const docker = (args, options = {}) => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { cwd: root, env, encoding: 'utf8', stdio: 'pipe', timeout: 60000, ...options })
  const database = 'supabase_db_' + project
  const sql = query => docker(['exec', '-i', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: query }).trim()
  const files = readdirSync(path.join(source, 'migrations')).filter(name => name.endsWith('.sql')).sort()
  for (const file of files) assert.deepEqual(readFileSync(path.join(source, 'migrations', file)), readFileSync(path.join(directory, 'supabase/migrations', file)))
  assert.deepEqual(readFileSync(path.join(source, 'seed.sql')), readFileSync(path.join(directory, 'supabase/seed.sql')))
  if (requireDatabase) {
    const info = JSON.parse(docker(['inspect', database]))[0]
    assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
    assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(binding => binding.HostPort === '61022'))
    assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version;').split('\n'), files.map(file => file.split('_')[0]))
  }
  return { env, credentials, docker, sql, database }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  assert.equal(process.env.LEDGER_BROWSER_DISPOSABLE_TEST, '1')
  assert.equal(process.argv.length, 3)
  const action = process.argv[2]; assert.ok(['prepare', 'start', 'stop'].includes(action))
  assert.ok(!retainedDirectory || action !== 'prepare', 'Retained fixtures may only be started/stopped')
  if (action === 'prepare') {
    const config = readFileSync(path.join(source, 'config.toml'), 'utf8').replace('project_id = "building-suit-ledger"', `project_id = "${project}"`)
      .replace(/\b603(\d\d)\b/g, (_match, suffix) => '610' + suffix)
      .replace('site_url = "http://127.0.0.1:3000"', 'site_url = "http://127.0.0.1:61030"')
      .replace('additional_redirect_urls = ["http://localhost:3000/confirm", "http://127.0.0.1:3000/confirm"]', 'additional_redirect_urls = ["http://127.0.0.1:61030/confirm"]')
      .replace('[auth]', '[auth]\njwt_secret = "env(LEDGER_BROWSER_JWT_SECRET)"\nanon_key = "env(LEDGER_BROWSER_ANON_KEY)"\nservice_role_key = "env(LEDGER_BROWSER_SERVICE_KEY)"')
    if (!existsSync(directory)) {
      mkdirSync(path.join(directory, 'supabase'), { recursive: true, mode: 0o700 })
      for (const item of ['migrations', 'templates', 'seed.sql']) cpSync(path.join(source, item), path.join(directory, 'supabase', item), { recursive: true })
      writeFileSync(path.join(directory, 'supabase/config.toml'), config, { mode: 0o600, flag: 'wx' })
      privateResult('owned-test-project.json', { task: 'LS-BROWSER-001', project, workdir: directory, database_port: 61022, api_port: 61021, ui_port: 61030 })
      const jwt = randomBytes(48).toString('base64url')
      const token = role => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
        const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 })).toString('base64url')
        return `${header}.${payload}.${createHmac('sha256', jwt).update(`${header}.${payload}`).digest('base64url')}`
      }
      privateResult('test-credentials.json', { jwt, anon: token('anon'), service: token('service_role') })
    }
    browserContext(false)
    assert.equal(readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8'), config)
  } else {
    const c = browserContext(action === 'stop')
    for (const kind of ['db', 'storage']) {
      const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', 'volume', 'inspect', `supabase_${kind}_${project}`], { env: c.env, encoding: 'utf8' })
      if (result.status === 0) {
        const volume = JSON.parse(result.stdout)[0]
        assert.equal(volume.Labels['com.supabase.cli.project'], project)
        assert.ok(Math.floor(Date.parse(volume.CreatedAt) / 1000) >= Math.floor(statSync(path.join(directory, 'owned-test-project.json')).birthtimeMs / 1000))
      } else assert.match(result.stderr, /no such volume|No such volume/)
    }
    const args = ['exec', 'supabase', '--workdir', directory, action]
    if (action === 'start') args.push('--ignore-health-check', '-x', 'realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor')
    const result = spawnSync('pnpm', args, { cwd: root, env: c.env, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024 })
    privateResult(retainedDirectory ? `${action}-${Date.now()}-${process.pid}.log` : action + '.log', (result.stdout || '') + (result.stderr || ''))
    assert.equal(result.status, 0, 'Inspect owned private runtime log')
    if (action === 'start') {
      browserContext()
      for (const route of ['/auth/v1/health', '/rest-admin/v1/ready']) assert.equal((await fetch('http://127.0.0.1:61021' + route, { headers: { apikey: c.credentials.anon }, signal: AbortSignal.timeout(5000) })).status, 200)
    }
  }
  console.log(JSON.stringify({ project, action, result: 'pass', reset_or_delete: false }))
}
