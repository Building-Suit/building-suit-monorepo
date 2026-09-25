// Run only against an explicitly prepared, owned disposable Supabase instance.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/customer-subledger'
const container = 'supabase_db_ledger-ar-008-disposable'
assert.equal(process.env.LEDGER_AR_DISPOSABLE_TEST, '1', 'Explicit disposable test opt-in required')
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 }).trim()
assert.equal(realpathSync(run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])), realpathSync(root + workdir))
assert.match(readFileSync(root + workdir + '/supabase/config.toml', 'utf8'), /^project_id = "ledger-ar-008-disposable"$/m)
const base = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = query => run('docker', [...base, '-c', query])
const source = root + 'apps/ledger-suit/supabase/migrations/'
const migrations = readdirSync(source).filter(name => name.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), migrations.map(name => name.split('_')[0]))
for (const name of migrations) assert.deepEqual(readFileSync(source + name), readFileSync(root + workdir + '/supabase/migrations/' + name))
const actor = randomUUID()
sql(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('${actor}','${actor}@ar.test','{}','{}');`)
const identity = `set request.jwt.claims='{"sub":"${actor}","role":"authenticated"}'; set role authenticated;`
const org = sql(`${identity} select public.create_organization('AR race ${actor}','EGP');`)
const control = sql(`${identity} select public.create_account('${org}','AR race control','asset','accounts_receivable',p_account_role=>'control',p_control_subledger_type=>'customer');`)
const revenue = sql(`${identity} select public.create_account('${org}','AR race revenue','revenue','service_revenue');`)
const cash = sql(`${identity} select public.create_account('${org}','AR race cash','asset','cash');`)
const customer = sql(`${identity} select public.create_counterparty('${org}','Race customer','customer');`)
const invoiceCall = `select public.post_ar_document('${org}','invoice','${customer}','${control}','2030-01-01',100,'${revenue}','INV-RACE','invoice-race','2030-01-31');`
const sessions = []
function session(name, query) {
  const child = spawn('docker', base, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
  const state = { child, output: '', error: '', exited: false, done: null }
  child.stdout.on('data', chunk => { state.output += chunk })
  child.stderr.on('data', chunk => { state.error += chunk })
  state.done = new Promise(resolve => child.on('close', code => { state.exited = true; resolve(code) }))
  child.stdin.write(`set application_name='${name}'; ${identity}\n${query}\n`)
  sessions.push(state)
  return state
}
async function until(predicate, message) {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message)
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}
async function race(label, first, second, rejection) {
  const winner = session(`ar-winner-${label}`, `begin; ${first} select 'ready';`)
  await until(() => winner.output.includes('ready') || winner.exited, 'Winner did not acquire AR lock')
  assert.equal(winner.exited, false, winner.error)
  const loser = session(`ar-loser-${label}`, second)
  loser.child.stdin.end('\\q\n')
  await until(() => sql(`select count(*) from pg_stat_activity where application_name='ar-loser-${label}' and wait_event_type='Lock'`) === '1', 'Competing AR command did not serialize')
  winner.child.stdin.end('commit;\n\\q\n')
  assert.equal(await winner.done, 0, winner.error)
  assert.equal(await loser.done, rejection ? 3 : 0, loser.error)
  if (rejection) assert.match(loser.error, rejection)
  else assert.equal(loser.output.trim().split('\n').at(-1), winner.output.trim().split('\n').at(-2), 'Concurrent retry returns original document')
}
try {
  await race('invoice', invoiceCall, invoiceCall)
  assert.equal(sql(`select count(*) from public.ar_documents where organization_id='${org}' and kind='invoice'`), '1')
  const invoice = sql(`select id from public.ar_documents where organization_id='${org}' and kind='invoice'`)
  const receipt = (key, amount) => `select public.post_ar_document('${org}','receipt','${customer}','${control}','2030-01-02',${amount},'${cash}','${key}','${key}',p_allocations=>'[{"invoice_id":"${invoice}","amount_minor":"${amount}"}]');`
  await race('receipt', receipt('receipt-retry', 20), receipt('receipt-retry', 20))
  await race('overlap', receipt('receipt-a', 60), receipt('receipt-b', 60), /AR_OVERPAYMENT/)
  assert.equal(sql(`select count(*) from public.ar_documents where organization_id='${org}' and kind='receipt'`), '2')
  assert.equal(sql(`${identity} select outstanding_minor from public.read_ar_open_items('${org}','2030-01-31');`), '20')
  assert.equal(sql(`${identity} select variance_minor from public.reconcile_control_accounts('${org}','2030-01-31');`), '0')
  console.log('PASS: concurrent invoice and receipt retries post once; overlapping allocations serialize and reject overpayment; AR equals Control.')
}
finally {
  for (const state of sessions) if (!state.exited) state.child.kill('SIGTERM')
}
// Preserve the disposable evidence. No implicit reset or financial deletion.
