// Prepare fresh, owned local recovery projects. Starts/resets/deletes nothing.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const role = process.argv[2]
assert.ok(['source', 'target'].includes(role), 'Choose source or target only')
assert.equal(process.argv.length, 3, 'Accepts no connection URL')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const source = path.join(root, 'apps/ledger-suit/supabase')
const project = `ledger-recovery-${role}-20261023`
const prefix = role === 'source' ? 606 : 607
const directory = path.join(root, '.local/verification/recovery', role)
const copied = path.join(directory, 'supabase')
const original = readFileSync(path.join(source, 'config.toml'), 'utf8')
assert.match(original, /^project_id = "building-suit-ledger"$/m)
const config = original.replace('project_id = "building-suit-ledger"', `project_id = "${project}"`)
  .replace(/\b603(\d\d)\b/g, (_match, suffix) => `${prefix}${suffix}`)
  .replace(/(\[db.seed\][\s\S]*?)enabled = true/, '$1enabled = false')
const marker = path.join(directory, 'owned-test-project.json')
const authNames = `LEDGER_RECOVERY_${role.toUpperCase()}`
const authenticatedConfig = config.replace('[auth]', `[auth]\njwt_secret = "env(${authNames}_JWT_SECRET)"\nanon_key = "env(${authNames}_ANON_KEY)"\nservice_role_key = "env(${authNames}_SERVICE_KEY)"`)
if (existsSync(directory)) {
  const owner = JSON.parse(readFileSync(marker, 'utf8'))
  assert.equal(owner.task, 'LS-OPS-RECOVERY-001')
  assert.equal(owner.project, project)
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  assert.equal(readFileSync(path.join(copied, 'config.toml'), 'utf8'), authenticatedConfig)
} else {
  mkdirSync(copied, { recursive: true })
  mkdirSync(path.join(copied, 'migrations'))
  cpSync(path.join(source, 'templates'), path.join(copied, 'templates'), { recursive: true })
  if (role === 'source') cpSync(path.join(source, 'migrations'), path.join(copied, 'migrations'), { recursive: true })
  writeFileSync(path.join(copied, 'config.toml'), authenticatedConfig)
  writeFileSync(marker, `${JSON.stringify({ task: 'LS-OPS-RECOVERY-001', project, role, workdir: directory, database_port: prefix * 100 + 22 }, null, 2)}\n`)
}
const files = readdirSync(path.join(source, 'migrations')).filter(file => file.endsWith('.sql')).sort()
const expected = role === 'source' ? files : []
assert.deepEqual(readdirSync(path.join(copied, 'migrations')).filter(file => file.endsWith('.sql')).sort(), expected)
const manifest = files.map(file => {
  const bytes = readFileSync(path.join(source, 'migrations', file))
  if (role === 'source') assert.deepEqual(readFileSync(path.join(copied, 'migrations', file)), bytes)
  return `${createHash('sha256').update(bytes).digest('hex')}  ${file}\n`
}).join('')
console.log(JSON.stringify({ role, project, workdir: path.relative(root, directory), database_port: prefix * 100 + 22,
  application_migrations_before_restore: expected.length, source_migration_manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
  result: 'prepared_only_no_database_action', target: 'Pristine provider schemas; application schema/data/history restored separately' }))
