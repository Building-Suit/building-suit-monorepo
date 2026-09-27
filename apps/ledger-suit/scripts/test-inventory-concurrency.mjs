// Run only against an explicitly prepared, owned disposable Supabase instance.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/inventory-accounting'
const container = 'supabase_db_ledger-inventory-014-disposable'
assert.equal(process.env.LEDGER_INVENTORY_DISPOSABLE_TEST, '1', 'Explicit disposable test opt-in required')
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 }).trim()
assert.equal(realpathSync(run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])), realpathSync(root + workdir))
assert.match(readFileSync(root + workdir + '/supabase/config.toml', 'utf8'), /^project_id = "ledger-inventory-014-disposable"$/m)
const base = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = query => run('docker', [...base, '-c', query])
const source = root + 'apps/ledger-suit/supabase/migrations/'
const migrations = readdirSync(source).filter(name => name.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), migrations.map(name => name.split('_')[0]))
for (const name of migrations) assert.deepEqual(readFileSync(source + name), readFileSync(root + workdir + '/supabase/migrations/' + name))
const actor = randomUUID()
sql(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('${actor}','${actor}@inventory.test','{}','{}');`)
const identity = `set request.jwt.claims='{"sub":"${actor}","role":"authenticated"}'; set role authenticated;`
const org = sql(`${identity} select public.create_organization('Inventory race ${actor}','EGP');`)
const account = (name, type, subtype, extra = '') => sql(`${identity} select public.create_account('${org}','${name}','${type}','${subtype}'${extra});`)
const control = sql(`${identity} select public.create_inventory_control_account('${org}','Inventory race control');`)
const cogs = account('Race COGS', 'expense', 'cost_of_sales')
const clearing = account('Race clearing', 'liability', 'other_liability')
const sourceId = sql(`${identity} select public.configure_inventory_source('${org}','race-source','${actor}','2035-01-01','${control}','${cogs}','${clearing}');`)
const fact = JSON.stringify({ schema_version: 1, currency: 'EGP', negative_stock: false, sequence: '1', movement_id: 'RACE-1', movement_version: 1,
  valuation_id: 'RACE-VALUE-1', valuation_version: 1, costing_method: 'source-approved', policy_version: '1', kind: 'purchase',
  effective_date: '2035-01-01', accounting_date: '2035-01-01', stock_quantity_after: '10', inventory_delta_minor: '10000',
  cogs_delta_minor: '0', inventory_balance_after_minor: '10000', cogs_balance_after_minor: '0' })
const call = `${identity} select public.ingest_inventory_fact('${org}','${sourceId}','${fact}'::jsonb);`
const sessions = []
function session(name) {
  const child = spawn('docker', base, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
  const state = { child, output: '', error: '', exited: false, done: null }
  child.stdout.on('data', chunk => { state.output += chunk })
  child.stderr.on('data', chunk => { state.error += chunk })
  state.done = new Promise(resolve => child.on('close', code => { state.exited = true; resolve(code) }))
  child.stdin.write(`set application_name='${name}'; begin; ${call} select 'ready';\n`)
  sessions.push(state)
  return state
}
async function until(predicate, message) {
  const deadline = Date.now() + 10_000
  while (!predicate()) { assert.ok(Date.now() < deadline, message); await new Promise(resolve => setTimeout(resolve, 30)) }
}
try {
  const winner = session('inventory-fact-winner')
  await until(() => winner.output.includes('ready') || winner.exited, 'Winner did not acquire source stream lock')
  assert.equal(winner.exited, false, winner.error)
  const loser = session('inventory-fact-retry')
  loser.child.stdin.end('commit;\n\\q\n')
  await until(() => sql("select count(*) from pg_stat_activity where application_name='inventory-fact-retry' and wait_event_type='Lock'") === '1', 'Concurrent inventory retry did not serialize')
  winner.child.stdin.end('commit;\n\\q\n')
  assert.equal(await winner.done, 0, winner.error)
  assert.equal(await loser.done, 0, loser.error)
  assert.equal(sql(`select count(*) from public.inventory_accounting_facts where source_id='${sourceId}'`), '1')
  assert.equal(sql(`select count(*) from public.transactions where idempotency_key='inventory:${sourceId}:1'`), '1')
  console.log('PASS: concurrent inventory retries serialize to one source fact and one shared-ledger journal.')
}
finally { for (const state of sessions) if (!state.exited) state.child.kill('SIGTERM') }
// Preserve the disposable evidence. No implicit reset or financial deletion.
