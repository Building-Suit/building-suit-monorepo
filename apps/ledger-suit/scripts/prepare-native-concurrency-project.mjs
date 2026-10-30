// Prepare one existing guarded race fixture. Never start, reset or delete a DB.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const profiles = {
  'customer-subledger': ['ledger-ar-008-disposable', 613, 'AR', 'customer-subledger'],
  'supplier-subledger': ['ledger-ap-009-disposable', 614, 'AP', 'supplier-subledger'],
  'fixed-assets': ['ledger-assets-011-disposable', 615, 'ASSETS', 'fixed-assets'],
  'inventory-accounting': ['ledger-inventory-014-disposable', 616, 'INVENTORY', 'inventory'],
  'fx-cross-currency': ['ledger-fx-001-disposable', 617, 'FX', 'fx-cross-currency'],
  'statement-classification': ['ledger-statement-classification-20260919', 643, 'CLASSIFICATION', 'statement-classification'],
}
const name = process.argv[2]
assert.ok(Object.hasOwn(profiles, name), `Choose one profile: ${Object.keys(profiles).join(', ')}`)
assert.equal(process.argv.length, 3, 'Accepts only the fixture profile, never a connection URL')
const [project, portPrefix, optIn, runner] = profiles[name]
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const source = path.join(root, 'apps/ledger-suit/supabase')
const relative = `.local/verification/${name}`
const target = path.join(root, relative)
const copied = path.join(target, 'supabase')
const sourceConfig = readFileSync(path.join(source, 'config.toml'), 'utf8')
assert.match(sourceConfig, /^project_id = "building-suit-ledger"$/m)
const config = sourceConfig.replace('project_id = "building-suit-ledger"', `project_id = "${project}"`)
  .replace(/\b603(\d\d)\b/g, (_match, suffix) => `${portPrefix}${suffix}`)
const marker = path.join(target, 'owned-test-project.json')
if (existsSync(target)) {
  const owner = JSON.parse(readFileSync(marker, 'utf8'))
  assert.equal(owner.task, 'LS-REL-CONC-001', 'Existing directory is not owned by this verification task')
  assert.equal(owner.project, project)
  assert.equal(realpathSync(owner.workdir), realpathSync(target))
  assert.equal(readFileSync(path.join(copied, 'config.toml'), 'utf8'), config, 'Existing copied configuration differs; inspect it explicitly')
} else {
  mkdirSync(path.dirname(target), { recursive: true })
  mkdirSync(target)
  mkdirSync(copied)
  // Copy only source needed for SQL initialization and configured email templates.
  // In particular, do not copy .env files, CLI links or local provider state.
  for (const entry of ['migrations', 'seed.sql', 'templates']) {
    cpSync(path.join(source, entry), path.join(copied, entry), { recursive: true })
  }
  writeFileSync(path.join(copied, 'config.toml'), config)
  writeFileSync(marker, `${JSON.stringify({ task: 'LS-REL-CONC-001', project, workdir: target, database_port: portPrefix * 100 + 22 }, null, 2)}\n`)
}
const files = readdirSync(path.join(source, 'migrations')).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(readFileSync(path.join(copied, 'seed.sql')), readFileSync(path.join(source, 'seed.sql')), 'Copied seed differs; inspect it explicitly')
assert.deepEqual(readdirSync(path.join(copied, 'migrations')).filter(file => file.endsWith('.sql')).sort(), files)
const manifest = files.map(file => {
  const contents = readFileSync(path.join(source, 'migrations', file))
  assert.deepEqual(readFileSync(path.join(copied, 'migrations', file)), contents, `Migration copy differs: ${file}`)
  return `${createHash('sha256').update(contents).digest('hex')}  ${file}\n`
}).join('')
console.log(JSON.stringify({
  profile: name, project, workdir: relative, migrations: files.length,
  migration_manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
  database_port: portPrefix * 100 + 22,
  test: `LEDGER_${optIn}_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-${runner}-concurrency.mjs`,
  result: 'prepared_only_no_database_action',
}))
