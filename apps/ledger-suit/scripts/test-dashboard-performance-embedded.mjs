import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
// Optional, isolated verification dependencies; never bundled into the product.
const require = createRequire(new URL('../../../.local/perf-validation/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto')
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm')
const { btree_gist } = require('@electric-sql/pglite/contrib/btree_gist')
const { citext } = require('@electric-sql/pglite/contrib/citext')
process.chdir(fileURLToPath(new URL('../../../', import.meta.url)))
const db = new PGlite({ extensions: { pgcrypto, citext, pg_trgm, btree_gist } })
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema extensions; create schema auth; create schema storage; create schema cron; create schema net; create schema vault;
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),phone text,phone_confirmed_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text,is_sso_user boolean default false,deleted_at timestamptz);
create table auth.identities(id uuid primary key,user_id uuid references auth.users,provider_id text,identity_data jsonb,provider text,last_sign_in_at timestamptz,created_at timestamptz,updated_at timestamptz);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,metadata jsonb);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create table cron.job(jobid bigint,jobname text);
create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
create function cron.unschedule(bigint) returns boolean language sql as $$select true$$;
create table vault.decrypted_secrets(name text,decrypted_secret text);
grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
set search_path=public,extensions;
`)

const requestedMigration = process.argv.find(argument => argument.startsWith('--migration='))?.split('=')[1]
const migration = requestedMigration ?? '20260927140000_rls_aware_dashboard_reads.sql'
const largeFixture = process.argv.includes('--large')
const perf002 = migration === '20260927200000_large_ledger_read_scalability.sql'
if (largeFixture && !perf002) throw new Error('--large is supported only with the LS-PERF-002 migration')
const dir = 'apps/ledger-suit/supabase/migrations'
for (const file of (await readdir(dir)).filter(x => x.endsWith('.sql') && x < migration).sort()) {
  let sql = await readFile(`${dir}/${file}`, 'utf8')
  sql = sql.replace(/create extension if not exists pg_cron with schema pg_catalog;/gi, '')
    .replace(/create extension if not exists pg_net with schema extensions;/gi, '')
  try { await db.exec(sql) } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }) }
}
console.log('Loaded migration history into disposable PGlite (provider shims).')
await db.exec(await readFile('apps/ledger-suit/scripts/fixtures/dashboard-performance.sql', 'utf8'))
const org = (await db.query("select id from public.organizations where name = 'PERF Alpha'")).rows[0].id
const otherOrg = (await db.query("select id from public.organizations where name = 'PERF Beta'")).rows[0].id
const ids = Object.fromEntries((await db.query('select key, id from perf_ids')).rows.map(row => [row.key, row.id]))
if (largeFixture) {
  await db.exec(`
    reset role;
    create temporary table perf_large_transactions as
    select gen_random_uuid() as id, i,
      date '2025-01-01' + (i % 610) as transaction_date
    from generate_series(1, 5260) i;
    insert into public.transactions(
      id, organization_id, type, status, source, transaction_date, posting_date,
      currency_code, description, adjustment_reason, created_by, posted_by,
      posted_at, created_at, updated_at
    )
    select id, '${org}', 'adjustment', 'draft', 'manual', transaction_date,
      null, 'EGP', 'Large fixture journal ' || i, 'Performance fixture',
      '51000000-0000-4000-8000-000000000001',
      null, null, transaction_date::timestamptz + i * interval '1 millisecond',
      transaction_date::timestamptz + i * interval '1 millisecond'
    from perf_large_transactions;
    insert into public.transaction_entries(
      organization_id, transaction_id, account_id, entry_index, side,
      amount_minor, currency_code, base_amount_minor, base_currency_code,
      exchange_rate, entry_date, posted_at
    )
    select '${org}'::uuid, fixture.id,
      case when side.entry_index = 0 then '${ids.bank}'::uuid else '${ids.equity}'::uuid end,
      side.entry_index,
      case when side.entry_index = 0 then 'debit'::public.entry_side else 'credit'::public.entry_side end,
      1000 + fixture.i, 'EGP', 1000 + fixture.i, 'EGP', 1,
      fixture.transaction_date, fixture.transaction_date::timestamptz
    from perf_large_transactions fixture
    cross join (values (0), (1)) side(entry_index);
    update public.transaction_entries entry
    set posted_at = fixture.transaction_date::timestamptz
    from perf_large_transactions fixture
    where entry.transaction_id = fixture.id;
    update public.transactions transaction
    set status = 'posted', posting_date = fixture.transaction_date,
      posted_at = fixture.transaction_date::timestamptz,
      posted_by = '51000000-0000-4000-8000-000000000001'
    from perf_large_transactions fixture
    where transaction.id = fixture.id;
    analyze public.transactions;
    analyze public.transaction_entries;
  `)
}
const login = async (suffix) => {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-${suffix.padStart(12, '0')}","role":"authenticated"}', false); set role authenticated;`)
}
const searchArgs = [
  '', "p_limit=>8", "p_limit=>3,p_offset=>3", "p_limit=>0,p_offset=>-1", "p_offset=>9999",
  "p_limit=>null,p_offset=>null,p_sort=>null,p_direction=>null", "p_limit=>999",
  "p_sort=>'invalid',p_direction=>'bad'", "p_search=>'   '", "p_search=>'Journal'", "p_search=>'JRN-'",
  "p_search=>'PERF Cash'", "p_search=>'PERF Equity'", "p_search=>'PERF Contact'", "p_search=>'PERF Category'",
  "p_search=>'PERF Small'", // non-leading account must not match a summary name
  "p_search=>'does-not-exist'", "p_min_amount_minor=>200,p_max_amount_minor=>800",
  "p_from_date=>'2026-09-03',p_to_date=>'2026-09-07'",
  "p_types=>array['adjustment']::public.transaction_type[]",
  "p_statuses=>array['posted']::public.transaction_status[]",
  "p_sources=>array['manual']::public.transaction_source[]",
  "p_sources=>array['reversal']::public.transaction_source[]",
  `p_category_ids=>array['${ids.category}']::uuid[]`,
  `p_account_ids=>array['${ids.bank}']::uuid[]`,
  `p_counterparty_ids=>array['${ids.contact}']::uuid[]`,
  "p_created_by_ids=>array['51000000-0000-4000-8000-000000000001']::uuid[]",
  `p_tag_ids=>array['${ids.tag}']::uuid[]`,
  "p_tag_ids=>array[]::uuid[]", "p_account_ids=>array[]::uuid[]",
  ...['transaction_date','journal_reference','type','source','status','debit','credit','created_at'].flatMap(sort =>
    ['asc','desc'].map(direction => `p_sort=>'${sort}',p_direction=>'${direction}',p_limit=>4,p_offset=>2`)),
]
const read = async sql => (await db.query(sql)).rows
const baseline = async () => ({
  summary: await read(`select public.dashboard_summary('${org}', '2026-09-20')`),
  monthly: await read(`select * from public.report_monthly_series('${org}', 6, '2026-09-20')`),
  liquid: await read(`select account_id,name,currency,net_debit_minor,subtype from public.account_balances where organization_id='${org}' and is_liquid and not is_archived order by account_id`),
  search: await Promise.all(searchArgs.map(args => read(`select * from public.search_transactions('${org}'${args ? ',' + args : ''})`))),
})
const evidence = {
  environment: largeFixture
    ? 'disposable PGlite 0.3.16; 20-month fixture with >=5,000 journals and >=10,000 posted lines; local evidence only'
    : 'disposable PGlite 0.3.16; small functional fixture, NOT reproduction latency evidence',
  migration,
}
const capturePlans = async after => {
  await login('1')
  const queries = {
    dashboard_summary: `select public.dashboard_summary('${org}', '2026-09-20')`,
    report_monthly_series: `select * from public.report_monthly_series('${org}',6,'2026-09-20')`,
    search_transactions: `select * from public.search_transactions('${org}',p_limit=>8)`,
    liquid_accounts: after ? `select * from public.dashboard_liquid_accounts('${org}')`
      : `select account_id,name,currency,net_debit_minor,subtype from public.account_balances where organization_id='${org}' and is_liquid and not is_archived`,
  }
  const plans = {}
  for (const [name,sql] of Object.entries(queries)) {
    await read(sql) // warm-up with the same auth context
    plans[name] = (await read('explain (analyze,buffers,settings,format json) '+sql))[0]['QUERY PLAN']
  }
  return plans
}
const probe = async after => {
  // Exercise the maintained read-only psql probe against this disposable DB too.
  // Only psql presentation directives/branching and fixed test variables change.
  await db.exec('reset role')
  let sql = await readFile('apps/ledger-suit/scripts/dashboard-performance-evidence.sql','utf8')
  sql = sql.replace(/\\if :after\n([\s\S]*?)\\else\n([\s\S]*?)\\endif/g, (_,post,pre) => after ? post : pre)
    .replace(/\\set ON_ERROR_STOP on/g,'').replace(/\\gset/g,';')
  const values = { organization_id: org, actor_id: '51000000-0000-4000-8000-000000000001', from_date: '2026-09-01', to_date: '2026-09-20' }
  sql = sql.replace(/:'(\w+)'/g, (_,name) => `'${values[name]}'`)
  return (await db.exec(sql)).flatMap(result => result.rows).find(row => row.accounting_snapshot).accounting_snapshot
}
if (largeFixture) {
  const queries = {
    dashboard_summary: `select public.dashboard_summary('${org}', '2026-09-20')`,
    report_monthly_series: `select * from public.report_monthly_series('${org}',6,'2026-09-20')`,
    search_transactions: `select * from public.search_transactions('${org}',p_limit=>8)`,
    dashboard_liquid_accounts: `select * from public.dashboard_liquid_accounts('${org}')`,
  }
  const captureCore = async () => Object.fromEntries(await Promise.all(
    Object.entries(queries).map(async ([name,sql]) => [name, await read(sql)]),
  ))
  const captureCorePlans = async () => Object.fromEntries(await Promise.all(
    Object.entries(queries).map(async ([name,sql]) => {
      await read(sql)
      return [name, (await read(`explain (analyze,buffers,settings,format json) ${sql}`))[0]['QUERY PLAN']]
    }),
  ))
  await login('1')
  const size = (await read(`select
    (select count(*) from public.transactions where organization_id='${org}') as journals,
    (select count(*) from public.transaction_entries where organization_id='${org}' and posted_at is not null) as posted_lines,
    (select count(distinct date_trunc('month',transaction_date)) from public.transactions where organization_id='${org}') as months`))[0]
  assert.ok(Number(size.journals) >= 5000 && Number(size.posted_lines) >= 10000 && Number(size.months) >= 20)
  const accountingBefore = await probe(true)
  await login('1')
  const before = await captureCore()
  const beforePlans = await captureCorePlans()
  await db.exec('reset role')
  await db.exec(await readFile(`${dir}/${migration}`, 'utf8'))
  await login('1')
  assert.deepEqual(await captureCore(), before, 'Large fixture core read results remain exact')
  assert.deepEqual(await probe(true), accountingBefore,
    'Large fixture TB, P&L, Balance Sheet, controls, VAT, inventory and assets remain exact')
  await login('1')
  const afterPlans = await captureCorePlans()
  evidence.fixture = size
  evidence.before = beforePlans
  evidence.after = afterPlans
  evidence.warm_runs_ms = {}
  for (const [name,sql] of Object.entries(queries)) {
    await read(sql)
    evidence.warm_runs_ms[name] = []
    for (let run = 0; run < 5; run++) {
      const started = performance.now()
      await read(sql)
      evidence.warm_runs_ms[name].push(Number((performance.now() - started).toFixed(3)))
    }
  }
  assert.equal(afterPlans.search_transactions[0].Plan['Temp Written Blocks'], 0,
    'Large-fixture recent-8 has no temporary-disk spill')
  for (const user of ['1','2','3','4']) {
    await login(user)
    for (const boundary of [
      `public.dashboard_summary('${org}')`,
      `public.report_monthly_series('${org}')`,
      `public.dashboard_liquid_accounts('${org}')`,
      `public.search_transactions('${org}')`,
      `app.search_recent_transaction_page('${org}')`,
      `app.search_transaction_page_bounded('${org}')`,
      `app.search_transaction_details('${org}',array[]::uuid[])`,
    ]) {
      const foreignBoundary = user === '4' ? boundary : boundary.replaceAll(org, otherOrg)
      await assert.rejects(() => read(`select * from ${foreignBoundary}`), error => error.code === '42501')
    }
  }
  await db.exec('reset role')
  assert.equal((await read(`select bool_and(relrowsecurity) as enabled from pg_class
    where oid in ('public.transactions'::regclass,'public.transaction_entries'::regclass,'public.accounts'::regclass)`))[0].enabled, true)
  await mkdir('apps/ledger-suit/docs/evidence/ls-perf-002', { recursive: true })
  await writeFile('apps/ledger-suit/docs/evidence/ls-perf-002/embedded-explain.json', JSON.stringify(evidence,null,2)+'\n')
  console.log(`PASS: representative fixture has ${size.journals} journals, ${size.posted_lines} posted lines and ${size.months} months.`)
  console.log('PASS: exact core reads/accounting snapshots, cross-tenant denial, global RLS, zero recent-8 temp spill and five warm local runs.')
  await db.close()
  process.exit(0)
}
const accountingBefore = await probe(false)
evidence.before = await capturePlans(false)
const before = []
for (const user of ['1','2','3']) { await login(user); before.push(await baseline()) }
const revoked = [
  ['accounts.read'], ['transactions.read'],
  ['categories.read','counterparties.read','tags.read','attachments.read','commitments.read'],
]
const setRevoked = async capabilities => {
  await db.exec('reset role')
  await db.query("update public.organization_members set revoked_capabilities=$1::text[] where organization_id=$2 and user_id='51000000-0000-4000-8000-000000000002'", [capabilities,org])
  await login('2')
}
const permissionSnapshot = async capabilities => {
  const snapshot = {
    summary: await read(`select public.dashboard_summary('${org}', '2026-09-20')`),
    monthly: await read(`select * from public.report_monthly_series('${org}',6,'2026-09-20')`),
    liquid: await read(`select account_id,name,currency,net_debit_minor,subtype from public.account_balances where organization_id='${org}' and is_liquid and not is_archived order by account_id`),
  }
  if (!capabilities.includes('transactions.read')) {
    snapshot.search = await Promise.all(['',"p_search=>'PERF Cash'","p_search=>'PERF Category'","p_search=>'PERF Contact'",`p_tag_ids=>array['${ids.tag}']::uuid[]`]
      .map(args => read(`select * from public.search_transactions('${org}'${args ? ','+args : ''})`)))
  }
  return snapshot
}
const maskedBefore = []
for (const capabilities of revoked) {
  await setRevoked(capabilities)
  maskedBefore.push(await permissionSnapshot(capabilities))
}
await setRevoked([])
await db.exec('reset role')
const financialSnapshot = async () => read(`select jsonb_build_object(
  'journals',(select jsonb_agg(to_jsonb(t) order by id) from public.transactions t),
  'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.transaction_entries e)
) as snapshot`)
const history = await financialSnapshot()
await db.exec(await readFile(`${dir}/${migration}`, 'utf8'))
assert.deepEqual(await financialSnapshot(), history, 'Migration leaves every journal and entry unchanged')
for (const [index,user] of ['1','2','3'].entries()) {
  await login(user)
  assert.deepEqual(await baseline(), before[index], `Owner/accountant/viewer ${user}: search/report values and contracts unchanged`)
  assert.deepEqual(await read(`select * from public.dashboard_liquid_accounts('${org}')`), before[index].liquid)
}
for (const [index,capabilities] of revoked.entries()) {
  await setRevoked(capabilities)
  assert.deepEqual(await permissionSnapshot(capabilities), maskedBefore[index], `Per-member revocations: ${capabilities}`)
  if (capabilities.includes('accounts.read')) {
    await assert.rejects(() => read(`select * from public.dashboard_liquid_accounts('${org}')`), error => error.code === '42501')
  } else {
    assert.deepEqual(await read(`select * from public.dashboard_liquid_accounts('${org}')`), maskedBefore[index].liquid)
  }
  if (capabilities.includes('transactions.read')) {
    await assert.rejects(() => read(`select * from public.search_transactions('${org}')`), error => error.code === '42501')
    await assert.rejects(() => read(`select * from app.search_transaction_page('${org}')`), error => error.code === '42501')
  }
}
await setRevoked(['reports.read'])
for (const query of [`select public.dashboard_summary('${org}')`,`select * from public.report_monthly_series('${org}')`]) {
  await assert.rejects(() => read(query), error => error.code === '42501')
}
await setRevoked([])
assert.deepEqual(await probe(true), accountingBefore, 'Read-only probe: TB, P&L, Balance Sheet, Controls, VAT, inventory and assets unchanged on small fixture')
evidence.after = await capturePlans(true)
const migrationSql = await readFile(`${dir}/${migration}`, 'utf8')
const wrapperSql = migrationSql.split('create or replace function public.search_transactions(')[1]
  .split('  return query\n')[1].split('\nend;')[0]
const defaults = { p_organization_id: `'${org}'::uuid`, p_limit: '8', p_offset: '0',
  p_sort: "'transaction_date'", p_direction: "'desc'" }
const pageQuery = wrapperSql.replace(/\bp_\w+\b/g, name => defaults[name] ?? 'null')
evidence.page_enrichment = (await read('explain (analyze,buffers,settings,format json) '+pageQuery))[0]['QUERY PLAN']
await mkdir('.local/perf-validation', { recursive: true })
const evidencePath = perf002 ? '.local/perf-validation/ls-perf-002-explain.json' : '.local/perf-validation/explain.json'
await writeFile(evidencePath, JSON.stringify(evidence,null,2)+'\n')
if (!perf002) {
  const walkPlans = plan => [plan, ...(plan.Plans ?? []).flatMap(walkPlans)]
  const nodes = walkPlans(evidence.page_enrichment[0].Plan)
  const enrichment = nodes.find(node => node['Relation Name'] === 'transactions' && node.Alias === 't')
  assert.equal(enrichment?.['Actual Loops'], 8, 'Summary transaction lookup runs exactly once per returned row')
}
assert.equal(evidence.after.search_transactions[0].Plan['Temp Written Blocks'], 0, 'Recent-8 has no temp spill')
console.log('PASS: per-member capability revocations preserve RLS masking/denial; before/after EXPLAIN (ANALYZE, BUFFERS, SETTINGS) saved.')
console.log(`PASS: ${searchArgs.length} search variants × owner/accountant/viewer; summary, monthly series, liquid balances and exact history preservation.`)
const boundaries = [
  `public.dashboard_summary('${org}')`, `public.report_monthly_series('${org}')`,
  `public.dashboard_liquid_accounts('${org}')`, `public.search_transactions('${org}')`,
  `app.search_transaction_page('${org}')`,
]
if (perf002) boundaries.push(
  `app.search_recent_transaction_page('${org}')`,
  `app.search_transaction_page_bounded('${org}')`,
  `app.search_transaction_details('${org}',array[]::uuid[])`,
)
for (const user of ['1','2','3','4']) {
  await login(user)
  for (const boundary of boundaries) {
    const sql = 'select * from ' + (user === '4' ? boundary : boundary.replaceAll(org, otherOrg))
    await assert.rejects(() => read(sql), error => error.code === '42501', `${user}: rejects foreign tenant at ${boundary}`)
  }
}
await db.exec('reset role')
assert.equal((await read("select bool_and(relrowsecurity) as enabled from pg_class where oid in ('public.transactions'::regclass,'public.transaction_entries'::regclass,'public.accounts'::regclass)"))[0].enabled, true)
for (const boundary of boundaries) {
  await db.exec("reset role; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false); set role anon")
  await assert.rejects(() => read('select * from '+boundary), error => error.code === '42501')
}
console.log('PASS: every boundary rejects cross-tenant owner/accountant/viewer/outsider and anonymous callers; global RLS remains enabled.')
await db.exec('reset role')
// Generate the additive RPC contract from this migrated catalog, without
// manually patching the older, generated whole-database snapshot.
const catalog = (await read(`select p.proargnames as names, p.proargmodes as modes,
  array(select format_type(t,null) from unnest(p.proallargtypes) t) as types
  from pg_proc p where p.oid='public.dashboard_liquid_accounts(uuid)'::regprocedure`))[0]
const types = { uuid: 'string', text: 'string', character: 'string', account_subtype: "Database['public']['Enums']['account_subtype']" }
const fields = mode => catalog.names.flatMap((name,index) => {
  if (catalog.modes[index] !== mode) return []
  const type = types[catalog.types[index]]
  assert.ok(type, `Unsupported catalog type: ${catalog.types[index]}`)
  return [`          ${name}: ${type}`]
}).join('\n')
const contract = `// Generated by scripts/test-dashboard-performance-embedded.mjs --generate-contract.
// Source: migrated PostgreSQL catalog. Do not edit.
import type { Database } from './database.types'

export type DashboardRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      dashboard_liquid_accounts: {
        Args: {
${fields('i')}
        }
        Returns: {
${fields('t')}
        }[]
      }
    }
  }
}
`
const contractPath = 'apps/ledger-suit/types/dashboard-rpc.types.ts'
if (process.argv.includes('--generate-contract')) await writeFile(contractPath, contract)
else assert.equal(await readFile(contractPath,'utf8'), contract, 'Client RPC contract matches migrated catalog')
await db.close()
