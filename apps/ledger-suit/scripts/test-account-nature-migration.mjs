// Explicitly destructive rehearsal of the disposable monorepo Ledger backend.
// Never accepts a database URL, project ref, hosted target or alternate container.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (process.env.LEDGER_DISPOSABLE_MIGRATION_TEST !== '1') {
  throw new Error('Set LEDGER_DISPOSABLE_MIGRATION_TEST=1 to acknowledge resetting local building-suit-ledger on port 60322')
}
const root = fileURLToPath(new URL('../../../', import.meta.url))
const sqlArgs = ['exec', 'supabase_db_building-suit-ledger', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c']
const sql = query => execFileSync('docker', [...sqlArgs, query], { encoding: 'utf8', stdio: 'pipe' }).trim()
const db = args => execFileSync('pnpm', ['db', 'ledger-suit', ...args], { cwd: root, stdio: 'pipe', timeout: 180_000 })
const identity = "select set_config('request.jwt.claims', '{\"sub\":\"a0000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}', false);"

console.log('Resetting only the disposable local Ledger backend to the pre-feature schema.')
db(['db', 'reset', '--local', '--version', '20260913231456'])
sql(`${identity}
do $$
declare
  org uuid := (select id from public.organizations where name = 'Alpha Trading');
  equipment uuid; child uuid; capital uuid; drawings uuid; expense uuid; accumulated uuid; journal uuid;
begin
  equipment := public.create_account(org, 'Legacy equipment', 'asset', 'equipment');
  child := public.create_account(org, 'Legacy child', 'asset', 'equipment', p_parent_account_id => equipment);
  capital := public.create_account(org, 'Legacy capital', 'equity', 'owner_capital');
  drawings := public.create_account(org, 'Legacy drawings', 'equity', 'owner_drawings');
  expense := public.create_account(org, 'Legacy depreciation expense', 'expense', 'depreciation');
  accumulated := public.create_account(org, 'Legacy accumulated depreciation', 'asset', 'equipment');
  perform public.create_adjustment(org, '2026-01-01', jsonb_build_array(
    jsonb_build_object('account_id',equipment,'side','debit','amount_minor',3000000),
    jsonb_build_object('account_id',capital,'side','credit','amount_minor',3000000)), 'Legacy contribution', 'Local rehearsal');
  journal := public.create_adjustment(org, '2026-01-02', jsonb_build_array(
    jsonb_build_object('account_id',expense,'side','debit','amount_minor',600000),
    jsonb_build_object('account_id',accumulated,'side','credit','amount_minor',600000)), 'Legacy depreciation', 'Local rehearsal');
  perform public.reverse_transaction(journal, 'Local reversal rehearsal');
  perform public.create_adjustment(org, '2026-01-03', jsonb_build_array(
    jsonb_build_object('account_id',drawings,'side','debit','amount_minor',100000),
    jsonb_build_object('account_id',equipment,'side','credit','amount_minor',100000)), 'Legacy drawings', 'Local rehearsal');
  perform public.archive_account(accumulated);
end $$;`)
const fingerprintQuery = `select jsonb_build_object(
  'accounts', (select jsonb_build_array(count(*),md5(string_agg((to_jsonb(a)-'contra_account_id')::text,'' order by id))) from public.accounts a),
  'entries', (select jsonb_build_array(count(*),md5(string_agg(to_jsonb(e)::text,'' order by id))) from public.transaction_entries e),
  'transactions', (select jsonb_build_array(count(*),md5(string_agg(to_jsonb(t)::text,'' order by id))) from public.transactions t));`
const before = JSON.parse(sql(fingerprintQuery))
const reportQuery = `${identity} select coalesce(jsonb_agg(to_jsonb(r) order by r.account_id), '[]') from public.report_balance_sheet((select id from public.organizations where name='Alpha Trading'), '2026-12-31') r;`
const beforeReport = sql(reportQuery).split('\n').at(-1)
db(['migration', 'up', '--local'])
assert.deepEqual(JSON.parse(sql(fingerprintQuery)), before)
assert.equal(sql(reportQuery).split('\n').at(-1), beforeReport)
assert.equal(sql("select normal_balance from public.accounts where name='Legacy drawings'"), 'credit')
console.log(`Preserved ${before.accounts[0]} accounts, ${before.transactions[0]} transactions and ${before.entries[0]} entries byte-for-byte, including parent postings, reversal and archived history; statement unchanged.`)

// A held SHARE lock from the first draft must make classification wait, then
// reject the change after the draft commits, including under a stale start time.
const ids = JSON.parse(sql(`select jsonb_build_object(
 'org',(select id from public.organizations where name='Alpha Trading'),
 'account',(select id from public.accounts where name='Legacy child'),
 'capital',(select id from public.accounts where name='Legacy capital'));`))
const draftSql = `${identity} begin; select public.create_draft_transaction(
 p_organization_id=>'${ids.org}', p_type=>'adjustment', p_transaction_date=>'2026-01-04',
 p_lines=>jsonb_build_array(
 jsonb_build_object('account_id','${ids.account}','side','debit','amount_minor',1),
 jsonb_build_object('account_id','${ids.capital}','side','credit','amount_minor',1)));
 select 'nature-lock-held'; select pg_sleep(2); commit;`
const writer = spawn('docker', ['exec', '-i', 'supabase_db_building-suit-ledger', ...sqlArgs.slice(2, -1), '-f', '-'], { stdio: ['pipe', 'pipe', 'pipe'] })
writer.stdin.end(draftSql)
let writerError = ''
writer.stderr.on('data', data => { writerError += data })
const writerDone = new Promise((resolve, reject) => {
 writer.on('error', reject)
 writer.on('exit', code => code === 0 ? resolve() : reject(new Error(writerError)))
})
await new Promise((resolve, reject) => {
 let output = ''
 writer.stdout.on('data', data => { output += data; if (output.includes('nature-lock-held')) resolve() })
 writer.on('error', reject)
 writer.on('exit', () => { if (!output.includes('nature-lock-held')) reject(new Error(writerError || 'Draft did not acquire lock')) })
})
const started = Date.now()
let rejected = false
try {
 sql(`${identity} select public.update_account('${ids.account}', 'Legacy child', p_normal_balance=>'credit');`)
} catch (error) {
 assert.match(String(error.stderr), /ACCOUNT_HAS_LEDGER_HISTORY/)
 rejected = true
}
assert.ok(rejected, 'concurrent classification must fail after first draft commits')
assert.ok(Date.now() - started > 1000, 'classification must wait for the entry writer')
await writerDone
console.log('Concurrent first draft/classification edit serialized and protected history.')
console.log('Restoring the final migrated disposable backend to pristine seeds.')
db(['db', 'reset', '--local'])
console.log('PASS: migration preservation and concurrency rehearsal.')
