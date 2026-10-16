// Full migrated SAS + real PostgREST, local-only; no keys or error bodies logged.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID, createHmac } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { buildCandidate } from './candidate.mjs'
import { parseChangelogFeed } from '../../packages/contracts/src/changelog.ts'
import { createCatalog } from './publisher.mjs'
import { dockerFailureReason, ensureDisposableImage } from './docker-harness.mjs'
assert.equal(process.env.RELEASE_POSTGREST_DISPOSABLE, '1', 'Explicit disposable validation required')
function command(program, args, input) {
  const result=spawnSync(program,args,{input,encoding:'utf8',timeout:120000})
  if(result.status!==0) throw new Error(`Disposable command failed (exit ${result.status}; SQLSTATE ${result.stderr.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1] ?? 'UNKNOWN'}); ${program==='docker'?dockerFailureReason(result.stderr):'COMMAND_FAILED'}; credentials and raw errors omitted`)
  return result.stdout.trim()
}
const suffix=randomUUID(), db=`bs-release-db-${suffix}`, rest=`bs-release-rest-${suffix}`, network=`bs-release-net-${suffix}`
const jwtSecret=randomUUID()+randomUUID()
const token=role=>{
  const data=[{alg:'HS256',typ:'JWT'},{role,exp:Math.floor(Date.now()/1000)+600}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')
  return data+'.'+createHmac('sha256',jwtSecret).update(data).digest('base64url')
}
const status={SERVICE_ROLE_KEY:token('service_role'),ANON_KEY:token('anon')}
const sql=statement=>command('docker',['exec','-i',db,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],statement)
ensureDisposableImage('postgres:17-alpine')
ensureDisposableImage('public.ecr.aws/supabase/postgrest:v16.1','docker.io/postgrest/postgrest:v16.1')
try {
command('docker',['network','create',network])
command('docker',['run','-d','--name',db,'--network',network,'--network-alias','release-db','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
for(let n=0;;n++) {
  if(spawnSync('docker',['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'ignore'}).status===0) break
  assert.ok(n<100,'Disposable PostgreSQL startup timeout');await delay(100)
}
// Provider contracts only; every SAS-owned object below comes from its actual migration.
// Auth/Realtime/Vault service implementation is outside this REST regression.
sql(`create role anon;create role authenticated;create role service_role;
create schema extensions;create extension pgcrypto with schema extensions;
create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create function auth.jwt() returns jsonb language sql as $$select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb$$;
create function auth.role() returns text language sql as $$select auth.jwt()->>'role'$$;
create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
create schema vault;create table vault.decrypted_secrets(id uuid,decrypted_secret text);
create schema realtime;create table realtime.messages(topic text,event text,extension text,payload jsonb,private boolean);
create function realtime.topic() returns text language sql as $$select current_setting('realtime.topic',true)$$;
create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into realtime.messages(payload,event,topic,private,extension) values($1,$2,$3,$4,'broadcast')$$;`)
const migrations=new URL('../../apps/super-admin-suit/supabase/migrations/',import.meta.url)
const names=readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()
let retainedSource
for(const name of names) {
  if(name.endsWith('_release_cardinality_location.sql')) retainedSource=sql("select md5(prosrc) from pg_proc where oid='public.release_candidate_refresh(jsonb)'::regprocedure;")
  console.log(`Apply SAS migration ${name}`)
  sql(readFileSync(new URL(name,migrations),'utf8'))
  if(name.startsWith('20261015030053')) {
sql(`insert into public.admin_environments(id,stable_key,environment_kind,display_name,status) values('a0bb00a1-747c-4cda-8521-9927d0b53065','sas-staging','staging','{}','active');
insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status) values('7924a9af-a970-4360-a0d0-76df4e18dbfc','shop-suit','{"en":"Shop","ar":"المتجر"}','/brand/fixture.svg','1.0','active');
`)
  }
}
assert.equal(sql("select md5(prosrc) from pg_proc where oid='super_admin_private.release_candidate_refresh_retained(jsonb)'::regprocedure;"),retainedSource,'Exact deployed body retained')
assert.equal(sql("select has_function_privilege('service_role','super_admin_private.release_candidate_refresh_retained(jsonb)','EXECUTE');"),'f')
// Test-only RPC demonstrates exact SQLSTATE/guard classification through PostgREST.
// It is created solely in this invocation's disposable database, never a migration.
sql(`create function public.release_candidate_diagnostic(p_code text,p_guard text) returns void language plpgsql as $$begin raise exception '%',p_guard using errcode=p_code;end$$;
revoke all on function public.release_candidate_diagnostic(text,text) from public,anon,authenticated;
grant execute on function public.release_candidate_diagnostic(text,text) to service_role;`)
command('docker',['run','-d','--name',rest,'--network',network,'-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgresql://postgres@release-db/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${jwtSecret}`,'public.ecr.aws/supabase/postgrest:v16.1'])
const port=command('docker',['port',rest,'3000/tcp']).split(':').at(-1)
status.API_URL=`http://127.0.0.1:${port}`
for(let n=0;;n++) {
  try {if((await fetch(status.API_URL)).ok) break} catch { /* Startup only. */ }
  assert.ok(n<100,'Disposable PostgREST startup timeout');await delay(100)
}
const ref='abcdefghijklmnopqrst'
// Keep the production adapter's binding/redirect/timeout/header behavior, remapping
// only its verified origin to the asserted disposable loopback API for transport.
const transport=(url,options)=>{
  const parsed=new URL(url)
  assert.equal(parsed.origin,`https://${ref}.supabase.co`)
  assert.match(parsed.pathname,/^\/rest\/v1\/rpc\/release_candidate_[a-z]+$/)
  return fetch(status.API_URL+parsed.pathname.replace('/rest/v1',''),options)
}
const catalog=createCatalog(`https://${ref}.supabase.co`,status.SERVICE_ROLE_KEY,ref,transport)
const state=await catalog('release_candidate_state')
assert.equal(state.model,2);assert.equal(state.environment,'staging')
for(const [code,guard,reason] of [
  ['42P10','private-sentinel','CATALOG_SQLSTATE_42P10_INVALID_COLUMN_REFERENCE'],
  ['22003','private-sentinel','CATALOG_SQLSTATE_22003_NUMERIC_VALUE_OUT_OF_RANGE'],
  ['P0001','IMMUTABLE_CANDIDATE_HISTORY','IMMUTABLE_CANDIDATE_HISTORY'],
  ['P0001','private-sentinel','CATALOG_GUARD_UNRECOGNIZED'],
]) {
  await assert.rejects(catalog('release_candidate_diagnostic',{p_code:code,p_guard:guard}),error=>{
    assert.ok(error.message.includes(`reason ${reason}`))
    assert.ok(!error.stack.includes('private-sentinel'))
    return true
  })
}
// Inventory must expose scalar parsed-body consumers, external policies and
// effective publication membership without reading any baseline/customer rows.
sql(`create function super_admin_private.fixture_atomic_baseline_consumer() returns text language sql begin atomic
  select production_sha from public.release_candidate_baseline;
end;
create table super_admin_private.fixture_inventory_rows(value integer);
alter table super_admin_private.fixture_inventory_rows enable row level security;
create policy fixture_external_baseline_policy on super_admin_private.fixture_inventory_rows using(exists(select 1 from public.release_candidate_baseline where singleton));
create publication fixture_baseline_publication for table public.release_candidate_baseline;`)
const inventorySql=readFileSync(new URL('./baseline-relation-inventory.sql',import.meta.url),'utf8')
const inventoryBefore=sql('select row_to_json(b) from public.release_candidate_baseline b;')
const inventory=JSON.parse(sql(`begin read only;${inventorySql}commit;`).split('\n').find(line=>line.startsWith('{')))
assert.ok(inventory.consumers.some(row=>row.catalog==='pg_proc'&&row.referenceCatalog==='pg_class'&&row.identity.includes('fixture_atomic_baseline_consumer')))
assert.ok(!inventory.consumers.some(row=>row.catalog==='pg_proc'&&row.referenceCatalog==='pg_type'&&row.identity.includes('fixture_atomic_baseline_consumer')),'Scalar parsed-body dependency is direct to the table, not its row type')
assert.ok(inventory.consumers.some(row=>row.catalog==='pg_policy'&&row.identity.includes('fixture_external_baseline_policy')))
assert.ok(inventory.publications.some(row=>row.name==='fixture_baseline_publication'))
assert.ok(!Object.hasOwn(inventory.relation,'production_sha'))
assert.equal(sql('select row_to_json(b) from public.release_candidate_baseline b;'),inventoryBefore)
assert.equal(sql("select to_regclass('super_admin_private.release_candidate_baseline_before_relation_repair') is null;"),'t')
console.log('Read-only metadata inventory passed: scalar BEGIN ATOMIC table dependency, external policy, publication membership and unchanged baseline')
const snapshot={...buildCandidate('origin/main','HEAD'),baseVersions:state.baseVersions}
sql(`create function public.release_candidate_trace(p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare ctx text; frame text[];begin
perform super_admin_private.release_candidate_refresh_retained(p_snapshot);return jsonb_build_object('unexpectedSuccess',true);
exception when cardinality_violation then get stacked diagnostics ctx=pg_exception_context;
frame:=regexp_match(ctx,'PL/pgSQL function (?:super_admin_private[.])?release_candidate_refresh_retained[(]jsonb[)] line ([0-9]+) at ([A-Za-z ]+)');
return jsonb_build_object('line',frame[1]::integer,'operation',frame[2]);end$$;
revoke all on function public.release_candidate_trace(jsonb) from public,anon,authenticated;grant execute on function public.release_candidate_trace(jsonb) to service_role;`)
const traceFrame=request=>JSON.parse(sql("set request.jwt.claims='{\"role\":\"service_role\"}';select public.release_candidate_trace('"+JSON.stringify(request).replaceAll("'","''")+"'::jsonb);").split('\n').at(-1))

const propertiesSql=readFileSync(new URL('./baseline-runtime-properties.sql',import.meta.url),'utf8')
const properties=()=>JSON.parse(sql(`begin read only;${propertiesSql}commit;`).split('\n').find(line=>line.startsWith('{')))
assert.equal(properties().rlsWouldApplyToRetained,false)
const constraintHashes=sql("select jsonb_agg(md5(pg_get_constraintdef(oid)) order by oid) from pg_constraint where conrelid='public.release_candidate_baseline'::regclass;")
assert.deepEqual(JSON.parse(constraintHashes).sort(),['7511e9a8e50c073e1d6eff73afcc0f24','9a7edf924a60685a990eb8cc48ba9653','ae6f6dfbe38290d5bfa8f3e96d1aff91'].sort(),'Exact three reported canonical hashes')
sql(`create function super_admin_private.fixture_generated_baseline_guard(p_sha text) returns boolean language plpgsql immutable as $$begin
if p_sha is null then return true;end if;return (select value from (values(true),(false)) v(value));end$$;
alter table public.release_candidate_baseline add column fixture_generated boolean generated always as (super_admin_private.fixture_generated_baseline_guard(production_sha)) stored;`)
assert.equal((await catalog('release_candidate_state')).productionSha,null)
assert.equal(sql("select count(*) from pg_trigger where tgrelid='public.release_candidate_baseline'::regclass and not tgisinternal;"),'0')
assert.equal(sql("select count(*) from pg_rewrite where ev_class='public.release_candidate_baseline'::regclass;"),'0')
assert.equal(sql("select jsonb_agg(md5(pg_get_constraintdef(oid)) order by oid) from pg_constraint where conrelid='public.release_candidate_baseline'::regclass;"),constraintHashes)
assert.deepEqual(traceFrame(snapshot),{line:16,operation:'SQL statement'})
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:snapshot}),/CANDIDATE_CARDINALITY_BASELINE_PIN/)
assert.equal((await catalog('release_candidate_state')).productionSha,null)
const generated=properties().columns.find(column=>column.name==='fixture_generated')
assert.equal(generated.generated,'s')
assert.ok(generated.generatedFunctions.some(fn=>fn.identity.includes('fixture_generated_baseline_guard')))
sql('alter table public.release_candidate_baseline drop column fixture_generated;drop function super_admin_private.fixture_generated_baseline_guard(text);')
console.log('BASELINE_PIN reproduced at native line16 SQL statement: canonical constraints/no hooks, generated-expression fault; metadata follow-up identifies it')
sql(`create function super_admin_private.fixture_baseline_index_guard(p_sha text) returns text language plpgsql immutable as $$begin
if p_sha is null then return null;end if;return (select value from (values('one'),('two')) v(value));end$$;
create index fixture_baseline_expression on public.release_candidate_baseline(super_admin_private.fixture_baseline_index_guard(production_sha));`)
assert.deepEqual(traceFrame(snapshot),{line:16,operation:'SQL statement'})
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:snapshot}),/CANDIDATE_CARDINALITY_BASELINE_PIN/)
assert.equal(sql("select jsonb_agg(md5(pg_get_constraintdef(oid)) order by oid) from pg_constraint where conrelid='public.release_candidate_baseline'::regclass;"),constraintHashes)
assert.ok(properties().indexes.some(index=>index.expression&&index.functions.some(fn=>fn.identity.includes('fixture_baseline_index_guard'))))
sql('drop index public.fixture_baseline_expression;drop function super_admin_private.fixture_baseline_index_guard(text);')
console.log('BASELINE_PIN also reproduced by an expression index with the same canonical constraints and no generated columns')

const first=await catalog('release_candidate_refresh',{p_snapshot:snapshot})
// The void readiness RPC returns204; successful acknowledgment must not parse JSON.
await catalog('release_candidate_ready',{p_key:first.key,p_digest:first.digest})
const publicResponse=await fetch(status.API_URL+'/rpc/release_public_feed',{method:'POST',headers:{authorization:`Bearer ${status.ANON_KEY}`,'content-type':'application/json'},body:'{}',redirect:'error'})
assert.equal(publicResponse.status,200)
const readyFeed=parseChangelogFeed(await publicResponse.json())
assert.ok(readyFeed.entries.length>0)
assert.equal(readyFeed.entries.length,snapshot.changes.filter(row=>row.disposition==='public').length)
assert.ok(readyFeed.entries.every(entry=>entry.status==='coming-soon'&&entry.targetVersion==='0.1.0'))
assert.equal(sql('select super_admin_private.fixture_atomic_baseline_consumer();'),snapshot.mainSha,'Parsed scalar consumer still reads the active authority')
const retries=await Promise.all([0,1].map(()=>catalog('release_candidate_refresh',{p_snapshot:snapshot})))
assert.ok(retries.every(row=>row.key===first.key&&row.digest===first.digest))
assert.equal(first.manifest.versions['shop-suit'],'0.1.0')
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,productionRef:'refs/heads/stg'}}),/DIGEST_CONFLICT/)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'f'.repeat(40),productionRef:'refs/heads/stg'}}),/WRONG_REFERENCE/)
const denied=createCatalog(`https://${ref}.supabase.co`,status.ANON_KEY,ref,transport)
await assert.rejects(denied('release_candidate_refresh',{p_snapshot:snapshot}),/HTTP (401|403)/)
// Multiple ordinary revisions are valid; no duplicate baseline assumption.
await catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'e'.repeat(40)}})
assert.equal(sql('select count(*) from public.release_candidate_revisions;'),'2')
// Persisted-state reproduction: legitimate revisions can expose a scalar helper
// defect while state and the singleton baseline remain valid.
assert.equal((await catalog('release_candidate_state')).model,2)
assert.equal(sql('select count(*) from public.release_candidate_baseline;'),'1')
const digestDefinition=sql("select pg_get_functiondef('super_admin_private.release_digest(jsonb)'::regprocedure);")
sql(`create or replace function super_admin_private.release_digest(p_value jsonb) returns text language sql stable set search_path='' as $$select (select key from public.release_candidate_revisions)$$;`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/CANDIDATE_CARDINALITY_DIGEST_CONTRACT_MISMATCH/)
sql(digestDefinition)
console.log('Persisted-state digest scalar fault reproduces state success and identifies the previously unrecognized digest contract mismatch without duplicate baseline data')
// Unknown deeper extension frame under a matching digest helper is still classified.
const cryptoDefinition=sql("select pg_get_functiondef('extensions.digest(bytea,text)'::regprocedure);")
sql(`create or replace function extensions.digest(bytea,text) returns bytea language plpgsql immutable strict as $$begin return (select value from (values('private-sentinel'::bytea),('private-sentinel'::bytea)) v(value));end$$;`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/reason CANDIDATE_CARDINALITY_DIGEST\)/)
sql(cryptoDefinition)
// Never interpret canonical line positions for an altered retained body.
const retainedDefinition=sql("select pg_get_functiondef('super_admin_private.release_candidate_refresh_retained(jsonb)'::regprocedure);")
sql(`create or replace function super_admin_private.release_candidate_refresh_retained(p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin return (select value from (values('{}'::jsonb),('{}'::jsonb)) v(value));end$$;`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/CANDIDATE_CARDINALITY_REFRESH_CONTRACT_MISMATCH/)
sql(retainedDefinition)
const inlineBaselineDefinition=sql("select pg_get_functiondef('super_admin_private.candidate_baseline_tree()'::regprocedure);")
sql(`create function super_admin_private.fixture_inline_baseline_guard() returns text language plpgsql stable as $$begin return (select manifest->>'mainTree' from public.release_candidate_revisions);end$$;
create or replace function super_admin_private.candidate_baseline_tree() returns text language sql stable as $$select super_admin_private.fixture_inline_baseline_guard()$$;
alter function super_admin_private.candidate_baseline_tree() reset all;
`)
assert.deepEqual(traceFrame({...snapshot,stagingSha:'d'.repeat(40)}),{line:15,operation:'IF'})
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/CANDIDATE_CARDINALITY_BASELINE_CONDITION/)
sql(inlineBaselineDefinition)
sql('drop function super_admin_private.fixture_inline_baseline_guard();')
console.log('Native attribution verified: inlined ELSIF fault reports line15 IF/legacy BASELINE_READ, decoded as BASELINE_CONDITION; not BASELINE_PIN')

const baselineDefinition=sql("select pg_get_functiondef('super_admin_private.candidate_baseline_tree()'::regprocedure);")
sql(`create or replace function super_admin_private.candidate_baseline_tree() returns text language plpgsql stable set search_path='' as $$begin return (select value from (values('private-sentinel'),('private-sentinel')) v(value));end$$;`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),error=>{
  assert.match(error.message,/CANDIDATE_CARDINALITY_BASELINE_TREE/)
  assert.doesNotMatch(error.stack,/private-sentinel/)
  return true
})
sql(baselineDefinition)
for(const [signature,returns,attributes,expression,reason] of [
  ['super_admin_private.release_copy_valid(jsonb)','boolean','immutable','(values(true),(false))','CANDIDATE_CARDINALITY_COPY_VALIDATOR'],
  ['super_admin_private.candidate_versions(jsonb)','jsonb','',"(values('{}'::jsonb),('{}'::jsonb))",'CANDIDATE_CARDINALITY_VERSION_VALIDATOR'],
  ['super_admin_private.release_context()','text','',"(values('staging'),('staging'))",'CANDIDATE_CARDINALITY_AUTHORITY'],
]) {
  const definition=sql(`select pg_get_functiondef('${signature}'::regprocedure);`)
  const declaration=signature.replace('(jsonb)','(p_snapshot jsonb)')
  // Keep the original input argument name when CREATE OR REPLACE requires it.
  const named=declaration.replace('release_copy_valid(p_snapshot','release_copy_valid(p_copy')
  sql(`create or replace function ${named} returns ${returns} language plpgsql ${attributes} security definer set search_path='' as $$begin return (select value from ${expression} v(value));end$$;`)
  await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),error=>{
    assert.ok(error.message.includes(reason));assert.ok(!error.stack.includes('private-sentinel'));return true
  })
  sql(definition)
}
// An unrelated trigger's private message must reduce to the refresh boundary.
sql(`create function public.release_fixture_cardinality() returns trigger language plpgsql as $$begin raise exception 'private-sentinel' using errcode='21000';end$$;
create trigger release_fixture_cardinality before insert on public.release_candidate_revisions for each row execute function public.release_fixture_cardinality();`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/CANDIDATE_CARDINALITY_REVISION_WRITE_TRIGGER_PRESENT/)
sql('drop trigger release_fixture_cardinality on public.release_candidate_revisions;drop function public.release_fixture_cardinality();')
sql(`create function public.release_fixture_cardinality() returns trigger language plpgsql as $$begin raise exception 'private-sentinel' using errcode='21000';end$$;
create trigger release_fixture_cardinality before insert on public.release_candidate_pointer for each row execute function public.release_fixture_cardinality();`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}}),/CANDIDATE_CARDINALITY_POINTER_WRITE_TRIGGER_PRESENT/)
sql('drop trigger release_fixture_cardinality on public.release_candidate_pointer;drop function public.release_fixture_cardinality();')
assert.equal(sql('select count(*) from public.release_candidate_revisions;'),'2','Failed writes roll back without deleting prior history')
await catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}})
assert.equal(sql('select count(*) from public.release_candidate_revisions;'),'3')

assert.equal(sql('select count(*) from public.release_candidate_promotions;'),'0')
assert.equal(sql('select version from public.release_candidate_versions;'),'0.0.0')
console.log('Full SAS PostgREST catalog passed: real createCatalog state/refresh, concurrent retry, invalid-ref denial, anonymous denial and unchanged production baseline/history and safe cardinality locations')

} finally {
  // Names are generated by this invocation; unrelated stacks/volumes are untouched.
  for(const name of [rest,db]) spawnSync('docker',['rm','-fv',name],{stdio:'ignore'})
  spawnSync('docker',['network','rm',network],{stdio:'ignore'})
}
