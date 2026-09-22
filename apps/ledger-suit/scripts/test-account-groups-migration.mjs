// Rehearse only on the explicitly owned, disposable group-review backend.
// Prepare its copy of the app config/history through account-nature first.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_GROUPS_DISPOSABLE_TEST, '1', 'Explicit disposable rehearsal opt-in required')
const root = fileURLToPath(new URL('../../../', import.meta.url))
const workdir = '.local/verification/account-groups'
const container = 'supabase_db_ledger-account-groups-20260919'
const migration = '20260919095839_explicit_account_groups.sql'
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 180_000 }).trim()
const owner = run('docker', ['inspect', container, '--format', '{{index .Config.Labels "com.supabase.cli.workdir"}}'])
assert.equal(realpathSync(owner), realpathSync(root + workdir))
const config = readFileSync(root + workdir + '/supabase/config.toml', 'utf8')
assert.match(config, /^project_id = "ledger-account-groups-20260919"$/m)
assert.match(config, /^port = 63322$/m)
const sql = query => run('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', query])
const source = root + 'apps/ledger-suit/supabase/migrations/'
const expected = readdirSync(source).filter(n => n.endsWith('.sql') && n !== migration).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), expected.map(n => n.split('_')[0]))
for (const name of expected) assert.deepEqual(readFileSync(source + name), readFileSync(root + workdir + '/supabase/migrations/' + name))
const identity = `select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);`
sql(`${identity}
do $$ declare
  org uuid := (select id from public.organizations where name='Alpha Trading');
  parent uuid; child uuid; capital uuid; contra uuid; txn uuid;
begin
  parent := public.create_account(org, 'Preserved parent', 'asset', 'bank');
  child := public.create_account(org, 'Preserved child', 'asset', 'bank', p_parent_account_id=>parent);
  capital := public.create_account(org, 'Preserved capital', 'equity', 'owner_capital');
  contra := public.create_account(org, 'Preserved contra', 'asset', 'bank', p_normal_balance=>'credit', p_contra_account_id=>parent);
  perform public.create_adjustment(org, '2026-01-01', jsonb_build_array(
    jsonb_build_object('account_id',parent,'side','debit','amount_minor',10000),
    jsonb_build_object('account_id',capital,'side','credit','amount_minor',10000)), 'Parent history', 'Disposable rehearsal');
  txn := public.create_adjustment(org, '2026-01-02', jsonb_build_array(
    jsonb_build_object('account_id',child,'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',contra,'side','credit','amount_minor',1000)), 'Reversal history', 'Disposable rehearsal');
  perform public.reverse_transaction(txn, 'Disposable reversal');
  perform public.archive_account(contra);
end $$;`)
const fingerprint = () => sql(`select jsonb_build_object(
 'accounts',(select jsonb_agg(to_jsonb(a)-'account_role' order by id) from public.accounts a),
 'transactions',(select jsonb_agg(to_jsonb(t) order by id) from public.transactions t),
 'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.transaction_entries e),
 'balances',(select jsonb_agg(to_jsonb(b)-'account_role' order by account_id) from public.account_balances b));`)
const report = () => sql(`${identity} select jsonb_agg(to_jsonb(r) order by account_id) from public.report_balance_sheet((select id from public.organizations where name='Alpha Trading'), '2026-12-31') r;`).split('\n').at(-1)
const before = fingerprint()
const beforeReport = report()
copyFileSync(source + migration, root + workdir + '/supabase/migrations/' + migration)
run('pnpm', ['exec', 'supabase', '--workdir', workdir, 'migration', 'up', '--local'])
assert.equal(fingerprint(), before, 'Every original account, transaction, entry and balance must survive exactly')
assert.equal(report(), beforeReport, 'Balance sheet must remain identical')
assert.equal(sql("select count(*) from public.accounts where account_role <> 'posting'"), '0')
const data = JSON.parse(before)
console.log(JSON.stringify({ result: 'PASS', accounts: data.accounts.length, transactions: data.transactions.length, entries: data.entries.length, sha256: createHash('sha256').update(before).digest('hex'), reportUnchanged: true, legacyParentsRemainPosting: true }))
// Only this script's verified disposable project is reset, restoring pristine
// seeds for quota SQL suites and browser tests. Other local projects stay intact.
run('pnpm', ['exec', 'supabase', '--workdir', workdir, 'db', 'reset', '--local', '--yes'])
console.log('PASS: restored pristine seeds in the owned disposable group-review backend')
