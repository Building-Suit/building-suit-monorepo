// Run only against an explicitly prepared, owned disposable Supabase instance.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/fx-cross-currency'
const container = 'supabase_db_ledger-fx-001-disposable'
assert.equal(process.env.LEDGER_FX_DISPOSABLE_TEST, '1', 'Explicit disposable test opt-in required')
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 }).trim()
assert.equal(realpathSync(run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])), realpathSync(root + workdir))
assert.match(readFileSync(root + workdir + '/supabase/config.toml', 'utf8'), /^project_id = "ledger-fx-001-disposable"$/m)
const base = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = query => run('docker', [...base, '-c', query])
const migrations = readdirSync(root + 'apps/ledger-suit/supabase/migrations').filter(name => name.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), migrations.map(name => name.split('_')[0]))
const actor = randomUUID()
sql(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('${actor}','${actor}@fx.test','{}','{}');`)
const identity = `set request.jwt.claims='{"sub":"${actor}","role":"authenticated"}'; set role authenticated;`
const org = sql(`${identity} select public.create_organization('FX race ${actor}','EGP');`)
const account = (name, type, subtype, extra = '') => sql(`${identity} select public.create_account('${org}','${name}','${type}','${subtype}'${extra});`)
const control = account('FX race control', 'asset', 'accounts_receivable', `,p_account_role=>'control',p_control_subledger_type=>'customer'`)
const revenue = account('FX race revenue', 'revenue', 'service_revenue')
const cash = sql(`${identity} select public.create_account('${org}','FX race USD bank','asset','bank','USD');`)
const gain = account('FX race gain', 'revenue', 'other_income')
const loss = account('FX race loss', 'expense', 'other_expense')
const ugain = account('FX race unrealized gain', 'revenue', 'other_income')
const uloss = account('FX race unrealized loss', 'expense', 'other_expense')
const customer = sql(`${identity} select public.create_counterparty('${org}','FX race customer','customer');`)
sql(`${identity} select public.configure_fx_accounts('${org}','${gain}','${loss}','${ugain}','${uloss}');`)
const item = sql(`${identity} select public.post_fx_open_item('${org}','customer','${customer}','${control}','${revenue}','2030-01-01','2030-01-31','FX-RACE','USD',10000,50,'2030-01-01','manual','RATE','ITEM');`)
const settlement = (key, amount) => `select public.post_fx_settlement('${org}','customer','${customer}','${control}','${cash}','2030-01-10','${key}','USD',${amount},60,'2030-01-10','manual','RATE','[{"item_id":"${item}","document_amount_minor":"${amount}","settlement_amount_minor":"${amount}","allocation_rate":"1","conversion_evidence":"AGREED"}]','${key}');`
const sessions = []
function session(name, query) {
  const child = spawn('docker', base, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
  const state = { child, output: '', error: '', exited: false, done: null }
  child.stdout.on('data', chunk => { state.output += chunk }); child.stderr.on('data', chunk => { state.error += chunk })
  state.done = new Promise(resolve => child.on('close', code => { state.exited = true; resolve(code) }))
  child.stdin.write(`set application_name='${name}'; ${identity}\n${query}\n`); sessions.push(state); return state
}
async function until(predicate, message) { const deadline = Date.now() + 10_000; while (!predicate()) { assert.ok(Date.now() < deadline, message); await new Promise(resolve => setTimeout(resolve, 30)) } }
async function race(label, first, second, rejection) {
  const winner = session(`fx-winner-${label}`, `begin; ${first} select 'ready';`)
  await until(() => winner.output.includes('ready') || winner.exited, 'Winner did not acquire FX lock')
  const loser = session(`fx-loser-${label}`, second); loser.child.stdin.end('\\q\n')
  await until(() => sql(`select count(*) from pg_stat_activity where application_name='fx-loser-${label}' and wait_event_type='Lock'`) === '1', 'Competing FX allocation did not serialize')
  winner.child.stdin.end('commit;\n\\q\n'); assert.equal(await winner.done, 0, winner.error); assert.equal(await loser.done, rejection ? 3 : 0, loser.error)
  if (rejection) assert.match(loser.error, rejection)
}
try {
  await race('overlap', settlement('FX-A', 6000), settlement('FX-B', 6000), /FX_OVERPAYMENT/)
  assert.equal(sql(`${identity} select x->>'outstanding_minor' from jsonb_array_elements(public.read_fx_workspace('${org}','customer','2030-01-10')->'items')x where x->>'id'='${item}';`), '4000')
  assert.equal(sql(`${identity} select variance_minor from public.reconcile_control_accounts('${org}','2030-01-10') where control_account_id='${control}';`), '0')
  console.log('PASS: competing cross-currency allocations serialize; one rejects overpayment; original-currency item equals base Control.')
}
finally { for (const state of sessions) if (!state.exited) state.child.kill('SIGTERM') }
