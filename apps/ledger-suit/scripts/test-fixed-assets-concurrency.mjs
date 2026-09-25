// Run only against an explicitly prepared, owned disposable Supabase instance.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/fixed-assets'
const container = 'supabase_db_ledger-assets-011-disposable'
assert.equal(process.env.LEDGER_ASSETS_DISPOSABLE_TEST, '1', 'Explicit disposable test opt-in required')
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 }).trim()
assert.equal(realpathSync(run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])), realpathSync(root + workdir))
assert.match(readFileSync(root + workdir + '/supabase/config.toml', 'utf8'), /^project_id = "ledger-assets-011-disposable"$/m)
const base = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = query => run('docker', [...base, '-c', query])
const source = root + 'apps/ledger-suit/supabase/migrations/'
const migrations = readdirSync(source).filter(name => name.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), migrations.map(name => name.split('_')[0]))
for (const name of migrations) assert.deepEqual(readFileSync(source + name), readFileSync(root + workdir + '/supabase/migrations/' + name))
const actor = randomUUID()
sql(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('${actor}','${actor}@assets.test','{}','{}');`)
const identity = `set request.jwt.claims='{"sub":"${actor}","role":"authenticated"}'; set role authenticated;`
const org = sql(`${identity} select public.create_organization('Asset race ${actor}','EGP');`)
const account = (name, type, subtype, extra = '') => sql(`${identity} select public.create_account('${org}','${name}','${type}','${subtype}'${extra});`)
const cost = account('Race equipment', 'asset', 'equipment')
const cash = account('Race cash', 'asset', 'cash')
const expense = account('Race depreciation', 'expense', 'depreciation')
const impairment = account('Race impairment', 'expense', 'other_expense')
const gainloss = account('Race gain loss', 'expense', 'other_expense')
const accumulated = account('Race accumulated', 'asset', 'equipment', `,p_normal_balance=>'credit',p_contra_account_id=>'${cost}'`)
const acquisition = sql(`${identity} select public.record_asset_purchase('${org}',120000,'${cost}','${cash}',p_transaction_date=>'2035-01-01',p_idempotency_key=>'race-acquisition');`)
const asset = sql(`${identity} select public.register_fixed_asset('${org}','RACE-1','Race machine','${acquisition}','${cost}','${accumulated}','${expense}','${impairment}','${gainloss}',120000,'2035-01-01','2035-01-01',12,12000,'straight_line',null,null,null,'race-register');`)
const schedule = sql(`select id from public.asset_depreciation_schedule where asset_id='${asset}' order by period_start limit 1;`)
const call = `${identity} select public.post_asset_depreciation('${org}','${schedule}','race-post');`
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
  const winner = session('asset-depreciation-winner')
  await until(() => winner.output.includes('ready') || winner.exited, 'Winner did not acquire asset-period lock')
  assert.equal(winner.exited, false, winner.error)
  const loser = session('asset-depreciation-retry')
  loser.child.stdin.end('commit;\n\\q\n')
  await until(() => sql("select count(*) from pg_stat_activity where application_name='asset-depreciation-retry' and wait_event_type='Lock'") === '1', 'Concurrent depreciation retry did not serialize')
  winner.child.stdin.end('commit;\n\\q\n')
  assert.equal(await winner.done, 0, winner.error)
  assert.equal(await loser.done, 0, loser.error)
  assert.equal(sql(`select count(*) from public.asset_events where asset_id='${asset}' and kind='depreciation'`), '1')
  assert.equal(sql(`select count(*) from public.transactions where idempotency_key='asset-depreciation:${asset}:2035-01-01'`), '1')
  console.log('PASS: concurrent depreciation retries serialize to one asset-period event and one shared-ledger journal.')
}
finally { for (const state of sessions) if (!state.exited) state.child.kill('SIGTERM') }
// Preserve the disposable evidence. No implicit reset or financial deletion.
