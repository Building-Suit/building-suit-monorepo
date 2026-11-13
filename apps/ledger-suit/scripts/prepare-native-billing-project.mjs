// Fresh owned local billing profile; never starts, resets or deletes a database.
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_BILLING_DISPOSABLE_TEST, '1')
assert.equal(process.argv.length, 2, 'Accepts no connection URL')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const source = path.join(root, 'apps/ledger-suit/supabase')
const directory = path.join(root, '.local/verification/billing')
const project = 'ledger-billing-20261025'
const original = readFileSync(path.join(source, 'config.toml'), 'utf8')
assert.match(original, /^project_id = "building-suit-ledger"$/m)
const config = original.replace('project_id = "building-suit-ledger"', `project_id = "${project}"`)
  .replace(/\b603(\d\d)\b/g, (_match, suffix) => `608${suffix}`)
  .replace(/(\[db.seed\][\s\S]*?)enabled = true/, '$1enabled = false')
  .replace('site_url = "http://127.0.0.1:3000"', 'site_url = "http://127.0.0.1:60830"')
  .replace('additional_redirect_urls = ["http://localhost:3000/confirm", "http://127.0.0.1:3000/confirm"]', 'additional_redirect_urls = ["http://127.0.0.1:60830/confirm"]')
  .replace('[auth]', '[auth]\njwt_secret = "env(LEDGER_BILLING_JWT_SECRET)"\nanon_key = "env(LEDGER_BILLING_ANON_KEY)"\nservice_role_key = "env(LEDGER_BILLING_SERVICE_KEY)"')
const marker = path.join(directory, 'owned-test-project.json')
if (existsSync(directory)) {
  const owner = JSON.parse(readFileSync(marker, 'utf8'))
  assert.equal(owner.task, 'LS-BILL-NATIVE-001')
  assert.equal(owner.project, project)
  assert.equal(realpathSync(owner.workdir), realpathSync(directory))
  assert.equal(readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8'), config)
} else {
  mkdirSync(path.join(directory, 'supabase'), { recursive: true, mode: 0o700 })
  for (const item of ['migrations', 'templates', 'functions']) cpSync(path.join(source, item), path.join(directory, 'supabase', item), { recursive: true })
  writeFileSync(path.join(directory, 'supabase/config.toml'), config, { mode: 0o600, flag: 'wx' })
  writeFileSync(marker, JSON.stringify({ task: 'LS-BILL-NATIVE-001', project, workdir: directory, database_port: 60822, api_port: 60821, mail_port: 60824, ui_port: 60830 }, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
}
const files = readdirSync(path.join(source, 'migrations')).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(readdirSync(path.join(directory, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort(), files)
const manifest = files.map(file => {
  const bytes = readFileSync(path.join(source, 'migrations', file))
  assert.deepEqual(readFileSync(path.join(directory, 'supabase/migrations', file)), bytes)
  return `${createHash('sha256').update(bytes).digest('hex')}  ${file}\n`
}).join('')
console.log(JSON.stringify({ project, workdir: path.relative(root, directory), migrations: files.length, migration_manifest_sha256: createHash('sha256').update(manifest).digest('hex'), result: 'prepared_only_no_database_action' }))
