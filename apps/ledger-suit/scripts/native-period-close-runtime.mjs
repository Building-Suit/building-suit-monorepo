// Fixed owned DB-only project; prepare/start/stop never reset or delete data.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
export const directory = path.join(root, '.local/verification/period-close')
export const project = 'ledger-period-close-20261026'
export function privateResult(name, value) { writeFileSync(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }) }
export function periodContext(requireDatabase = true) {
  assert.equal(process.env.LEDGER_PERIOD_DISPOSABLE_TEST, '1', 'Explicit owned test opt-in required')
  const owner = JSON.parse(readFileSync(path.join(directory, 'owned-test-project.json'), 'utf8'))
  assert.equal(owner.task, 'LS-REL-CLOSE-001'); assert.equal(owner.project, project); assert.equal(owner.database_port, 60922)
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  assert.match(readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8'), /^project_id = "ledger-period-close-20261026"$/m)
  const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local' }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
  const dockerArgs = ['--host=unix:///var/run/docker.sock']
  const docker = (args, options = {}) => execFileSync('docker', [...dockerArgs, ...args], { cwd: root, env, encoding: 'utf8', timeout: 60000, stdio: 'pipe', ...options })
  const database = 'supabase_db_' + project
  const base = ['exec', '-i', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1']
  const sql = query => docker(base, { input: query }).trim()
  if (requireDatabase) {
    const info = JSON.parse(docker(['inspect', database]))[0]
    assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
    assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(binding => binding.HostPort === '60922'))
    const files = readdirSync(path.join(root, 'apps/ledger-suit/supabase/migrations')).filter(file => file.endsWith('.sql')).sort()
    assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version;').split('\n'), files.map(file => file.split('_')[0]))
    for (const file of files) assert.deepEqual(readFileSync(path.join(root, 'apps/ledger-suit/supabase/migrations', file)), readFileSync(path.join(directory, 'supabase/migrations', file)))
  }
  return { env, docker, dockerArgs, database, base, sql }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  assert.equal(process.env.LEDGER_PERIOD_DISPOSABLE_TEST, '1')
  assert.equal(process.argv.length, 3)
  const action = process.argv[2]; assert.ok(['prepare', 'start', 'stop'].includes(action))
  if (action === 'prepare') {
    const source = path.join(root, 'apps/ledger-suit/supabase')
    const config = readFileSync(path.join(source, 'config.toml'), 'utf8').replace('project_id = "building-suit-ledger"', `project_id = "${project}"`).replace(/\b603(\d\d)\b/g, (_match, suffix) => '609' + suffix).replace(/(\[db.seed\][\s\S]*?)enabled = true/, '$1enabled = false')
    if (!existsSync(directory)) {
      mkdirSync(path.join(directory, 'supabase'), { recursive: true, mode: 0o700 })
      for (const item of ['migrations', 'templates']) cpSync(path.join(source, item), path.join(directory, 'supabase', item), { recursive: true })
      writeFileSync(path.join(directory, 'supabase/config.toml'), config, { mode: 0o600, flag: 'wx' })
      privateResult('owned-test-project.json', { task: 'LS-REL-CLOSE-001', project, workdir: directory, database_port: 60922 })
    }
    periodContext(false)
    assert.equal(readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8'), config)
  } else {
    const c = periodContext(action === 'stop')
    const volume = spawnSync('docker', [...c.dockerArgs, 'volume', 'inspect', 'supabase_db_' + project], { env: c.env, encoding: 'utf8' })
    if (volume.status === 0) {
      const info = JSON.parse(volume.stdout)[0]; assert.equal(info.Labels['com.supabase.cli.project'], project)
      assert.ok(Math.floor(Date.parse(info.CreatedAt) / 1000) >= Math.floor(statSync(path.join(directory, 'owned-test-project.json')).birthtimeMs / 1000))
    } else assert.match(volume.stderr, /no such volume|No such volume/)
    const args = ['exec', 'supabase', '--workdir', directory, action]
    if (action === 'start') args.push('-x', 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor')
    const result = spawnSync('pnpm', args, { cwd: root, env: c.env, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024 })
    privateResult(action + '.log', (result.stdout || '') + (result.stderr || ''))
    assert.equal(result.status, 0, 'Inspect owned private runtime log')
    if (action === 'start') periodContext()
  }
  console.log(JSON.stringify({ project, action, result: 'pass', reset_or_delete: false }))
}
