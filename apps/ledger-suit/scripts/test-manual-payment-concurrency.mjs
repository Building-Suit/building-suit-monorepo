import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

// Commits synthetic fixtures. Run only against a separately provisioned,
// disposable local Ledger database with the complete migration chain applied.
if (!process.argv.includes('--disposable-local')) throw new Error('Pass --disposable-local to authorize synthetic committed fixtures.')
const url = new URL(process.env.MANUAL_PAYMENT_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:60322/postgres')
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.port !== '60322') throw new Error('Only the local Ledger database on port 60322 is allowed.')
const owner = randomUUID(), operator = randomUUID(), request = randomUUID(), evidence = randomUUID()
const application = `manual-concurrency-${randomUUID()}`
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) }
function sql(source, name = application, marker) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', errors = ''
    child.stdout.on('data', (chunk) => { output += chunk; if (output.includes('APPROVAL_LOCKED')) marker?.() })
    child.stderr.on('data', chunk => { errors += chunk })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors || `psql exited ${code}`)))
    child.stdin.end(source)
  })
}
const claims = user => `select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',false); set role authenticated;`
await sql(`
insert into auth.users(id,email,raw_user_meta_data) values
('${owner}','${owner}@example.test','{"full_name":"Concurrency Owner"}'),
('${operator}','${operator}@example.test','{"full_name":"Concurrency Operator"}');
insert into app.manual_payment_operators(user_id) values('${operator}');
insert into app.manual_payment_configuration(instructions) values('Disposable test recipient') on conflict do nothing;
${claims(owner)}
select public.create_organization('Manual concurrency ${request}','EGP');
select public.prepare_manual_payment('${request}',(select organization_id from public.organization_members where user_id='${owner}'),'solo','monthly');
reset role;
insert into storage.objects(bucket_id,name,metadata)
select 'manual-payment-receipts',organization_id::text||'/${request}/${evidence}','{"size":100,"mimetype":"image/png"}' from public.manual_payment_requests where id='${request}';
select set_config('request.jwt.claims','{"role":"service_role"}',false); set role service_role;
select public.submit_manual_payment('${request}','${evidence}','${owner}','receipt.png',repeat('a',64),'Concurrency fixture');
`)
const command = `select (public.review_manual_payment('${request}','${evidence}','approved','Verified transfer')).period_end;`
let signalLocked
const locked = new Promise(resolve => { signalLocked = resolve })
const first = sql(`begin; ${claims(operator)} ${command} select 'APPROVAL_LOCKED'; select pg_sleep(5); commit;`, `${application}-first`, signalLocked)
await Promise.race([locked, first.then(() => { throw new Error('First session did not acquire approval lock') })])
const second = sql(`begin; ${claims(operator)} ${command} commit;`, `${application}-second`)
let observedLock = false
for (let attempt = 0; attempt < 30 && !observedLock; attempt++) {
  observedLock = await sql(`select exists(select 1 from pg_stat_activity where application_name='${application}-second' and wait_event_type='Lock');`) === 't'
  if (!observedLock) await new Promise(resolve => setTimeout(resolve, 50))
}
await Promise.all([first, second])
assert.ok(observedLock, 'second approval must actually wait on the first transaction')
assert.equal(await sql(`select count(*) from public.manual_payment_history where request_id='${request}' and after_state='approved';`), '1')
assert.equal(await sql(`select s.current_period_end=r.period_end and r.period_end=r.period_start+interval '1 month' and s.provider='manual' from public.manual_payment_requests r join public.subscriptions s using(organization_id) where r.id='${request}';`), 't')
await sql(`${claims(operator)} ${command}`)
assert.equal(await sql(`select count(*) from public.manual_payment_history where request_id='${request}' and after_state='approved';`), '1')
console.log('Two real sessions: lock contention observed, one activation, exact monthly period, replay unchanged.')
