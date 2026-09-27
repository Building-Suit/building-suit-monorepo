import { readFile, readdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
// Optional, isolated verification dependencies; never bundled into the product.
const require = createRequire(new URL('../../../.local/ar-validation/package.json', import.meta.url))
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
const preservationSql = `
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('40000000-0000-4000-8000-000000000099','ar-preservation@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000099","role":"authenticated"}',false);
do $$ declare org uuid; ar uuid; revenue uuid; customer uuid; begin
 org:=public.create_organization('AR migration preservation','EGP');
 ar:=public.create_account(org,'Preserved Control','asset','accounts_receivable',p_account_role=>'control',p_control_subledger_type=>'customer');
 revenue:=public.create_account(org,'Preserved revenue','revenue','service_revenue');
 customer:=public.create_counterparty(org,'Preserved customer','customer');
 perform public.create_control_adjustment(org,ar,'2030-01-01',jsonb_build_array(
 jsonb_build_object('account_id',ar,'side','debit','amount_minor',12345),
 jsonb_build_object('account_id',revenue,'side','credit','amount_minor',12345)),
 'Pre-migration adjustment','Reviewed variance','reconciliation_case','PRESERVE','PRESERVE');
 insert into public.commitments(organization_id,type,title,amount_minor,currency_code,due_date,counterparty_id,created_by)
 values(org,'receivable','Preserved legacy',12345,'EGP','2030-01-01',customer,auth.uid());
end $$;
`
const snapshotSql = `select jsonb_build_object(
 'journals',(select jsonb_agg(to_jsonb(t) order by id) from public.transactions t),
 'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.transaction_entries e),
 'legacy',(select jsonb_agg(to_jsonb(c) order by id) from public.commitments c),
 'totals',(select jsonb_build_object('debits',sum(base_amount_minor) filter(where side='debit'),'credits',sum(base_amount_minor) filter(where side='credit')) from public.transaction_entries),
 'control',(select jsonb_agg(to_jsonb(b) order by account_id) from public.account_balances b where account_role='control')
 ) evidence`
let before
const dir='apps/ledger-suit/supabase/migrations'
for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) {
 if (file.endsWith('_accrual_customer_subledger.sql')) {
   await db.exec(preservationSql)
   before = (await db.query(snapshotSql)).rows[0].evidence
 }
 let sql=await readFile(`${dir}/${file}`,'utf8')
 sql=sql.replace(/create extension if not exists pg_cron with schema pg_catalog;/gi,'').replace(/create extension if not exists pg_net with schema extensions;/gi,'')
 try {await db.exec(sql)} catch(e) { console.error(file,e.message,e.detail ?? '',e.where ?? ''); process.exit(1) }
}
assert.deepEqual((await db.query(snapshotSql)).rows[0].evidence,before,'Migration preserves every journal, entry, legacy record, total and Control balance')
console.log(JSON.stringify({ preservation: 'PASS', journals: before.journals.length, entries: before.entries.length, totals: before.totals, controlBalance: before.control[0].balance_minor }))
console.log('All migrations loaded (provider auth/storage/cron shims).')
{
 const sql=await readFile(process.argv[2] ?? 'apps/ledger-suit/supabase/tests/40_customer_subledger_test.sql','utf8')
 try {const results=await db.exec(sql); for(const r of results) for(const row of r.rows) console.log(JSON.stringify(row))} catch(e) {console.error(e.message,e.detail??'',e.where??'');process.exit(1)}
}
await writeFile('.local/ar-validation/catalog.json',JSON.stringify((await db.query(await readFile('apps/ledger-suit/scripts/ar-contract-catalog.sql','utf8'))).rows[0].json_agg,null,2))
await db.close()
