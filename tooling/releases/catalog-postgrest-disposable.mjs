// Full migrated SAS + real PostgREST, local-only; no keys or error bodies logged.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID, createHmac, createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { retrospectivePlan } from './retrospective.mjs'
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
// Compile the actual pinned extension only inside this owned disposable DB.
const extensionDir=new URL('./fixtures/pg-safeupdate/',import.meta.url)
const extensionSource=JSON.parse(readFileSync(new URL('source.json',extensionDir),'utf8'))
for(const [name,expected] of Object.entries(extensionSource.sha256)) assert.equal(createHash('sha256').update(readFileSync(new URL(name,extensionDir))).digest('hex'),expected)
command('docker',['exec',db,'mkdir','-p','/tmp/pg-safeupdate'])
for(const name of ['safeupdate.c','Makefile','LICENSE']) command('docker',['cp',new URL(name,extensionDir).pathname,`${db}:/tmp/pg-safeupdate/${name}`])
// Preserve TLS verification; use the platform's public CA bundle in this disposable container.
if(existsSync('/etc/ssl/certs/ca-certificates.crt')) command('docker',['cp','/etc/ssl/certs/ca-certificates.crt',`${db}:/etc/ssl/certs/ca-certificates.crt`])
command('docker',['exec',db,'sh','-c','apk add --no-cache build-base >/dev/null && cd /tmp/pg-safeupdate && make with_llvm=no >/dev/null && make install with_llvm=no >/dev/null'])
// Provider contracts only; every SAS-owned object below comes from its actual migration.
// Auth/Realtime/Vault service implementation is outside this REST regression.
sql(`create role anon;create role authenticated;create role service_role;
create role authenticator login noinherit;grant anon,authenticated,service_role to authenticator;
alter role authenticator set session_preload_libraries='safeupdate';
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
const previewRepair=names.find(name=>name.endsWith('_durable_release_preview.sql'))
assert.ok(previewRepair)
const qualifiedRepair=names.find(name=>name.endsWith('_qualified_release_baseline_pin.sql'))
assert.ok(qualifiedRepair)
const internalConsumerMigration=names.find(name=>name.endsWith('_release_internal_doctor_consumer.sql'))
assert.ok(internalConsumerMigration)
// Current-candidate provenance prerequisites must be present even in the
// intentionally pre-repair BASELINE_PIN reproduction. Do not filter the candidate.
const laterMigrations=names.filter(name=>name>qualifiedRepair && name!==internalConsumerMigration)
const registrationTables=['suit_registry','admin_environments','suit_environment_bindings','adapter_capability_policy','navigation_items','release_candidate_baseline','release_candidate_versions','release_manifests','release_candidate_revisions','release_candidate_pointer','release_candidate_promotions']
const registrationSnapshot=()=>sql(`select jsonb_build_object(${registrationTables.map(name=>`'${name}',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.${name} r)`).join(',')});`)
for(const name of names.filter(name=>name!==qualifiedRepair && !laterMigrations.includes(name))) {
  if(name.endsWith('_release_cardinality_location.sql')) retainedSource=sql("select md5(prosrc) from pg_proc where oid='public.release_candidate_refresh(jsonb)'::regprocedure;")
  console.log(`Apply SAS migration ${name}`)
  const beforeRegistration=name===internalConsumerMigration?registrationSnapshot():null
  sql(readFileSync(new URL(name,migrations),'utf8'))
  if(beforeRegistration!==null) {
    assert.equal(registrationSnapshot(),beforeRegistration,'Internal consumer recognition cannot change operational registration or release history/baselines')
    assert.equal(sql("select count(*) from super_admin_private.release_internal_consumers where stable_key='doctor-suit';"),'1')
    assert.equal(sql("select count(*) from public.suit_registry where stable_key='doctor-suit';"),'0','Doctor is not an operational/public product')
    for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_table_privilege('${role}','super_admin_private.release_internal_consumers','SELECT');`),'f')
    sql(readFileSync(new URL(name,migrations),'utf8'))
    assert.equal(registrationSnapshot(),beforeRegistration,'Idempotent replay preserves every registration and release record')
    console.log('Doctor private provenance recognized without operational/public registration, baseline or privilege changes')
  }
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
sql(`create function public.release_candidate_safety() returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('authenticatorSession',session_user='authenticator','guardEnabled',current_setting('safeupdate.enabled',true)='on')$$;
create function public.release_candidate_trace(p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare msg text;begin
perform super_admin_private.release_candidate_refresh_retained(p_snapshot);return jsonb_build_object('guardRejected',false);
exception when cardinality_violation then get stacked diagnostics msg=message_text;
return jsonb_build_object('guardRejected',msg='UPDATE requires a WHERE clause');end$$;
create function public.release_candidate_unsafe() returns void language plpgsql security definer set search_path='' as $$begin update public.release_candidate_baseline set production_sha=production_sha;end$$;
revoke all on function public.release_candidate_safety(),public.release_candidate_trace(jsonb),public.release_candidate_unsafe() from public,anon,authenticated;
grant execute on function public.release_candidate_safety(),public.release_candidate_trace(jsonb),public.release_candidate_unsafe() to service_role;`)
command('docker',['run','-d','--name',rest,'--network',network,'-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgresql://authenticator@release-db/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${jwtSecret}`,'public.ecr.aws/supabase/postgrest:v16.1'])
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
  assert.match(parsed.pathname,/^\/rest\/v1\/rpc\/release_(?:candidate_[a-z]+|history_import)$/)
  return fetch(status.API_URL+parsed.pathname.replace('/rest/v1',''),options)
}
const catalog=createCatalog(`https://${ref}.supabase.co`,status.SERVICE_ROLE_KEY,ref,transport)
assert.deepEqual(await catalog('release_candidate_safety'),{authenticatorSession:true,guardEnabled:true})
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
const publicDoctor={id:'fixture-public-doctor',task:'DOS-M1-002',suits:['doctor-suit'],classification:'minor',disposition:'public',paths:['apps/doctor-suit'],reason:'Attempt public allocation for an internal-only consumer',notes:{title:{en:'Doctor preview',ar:'معاينة الطبيب'},summary:{en:'Doctor preview',ar:'معاينة الطبيب'},details:{en:'Doctor preview',ar:'معاينة الطبيب'}}}
await assert.rejects(catalog('release_candidate_trace',{p_snapshot:{...snapshot,changes:[publicDoctor]}}),/UNREGISTERED_SUIT/,'Private recognition never grants Doctor public release authority')
assert.deepEqual(await catalog('release_candidate_state'),state,'Rejected Doctor public allocation preserves release state')
assert.deepEqual(await catalog('release_candidate_trace',{p_snapshot:snapshot}),{guardRejected:true})
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:snapshot}),/CANDIDATE_CARDINALITY_BASELINE_PIN/)
assert.deepEqual(await catalog('release_candidate_state'),state,'Original guard rejection rolls back without consuming history/version')
console.log('Confirmed real pg-safeupdate/authenticator/PostgREST reproduces original BASELINE_PIN on canonical relation')
sql(readFileSync(new URL(qualifiedRepair,migrations),'utf8'))
for(const name of laterMigrations) sql(readFileSync(new URL(name,migrations),'utf8'))
assert.deepEqual(await catalog('release_candidate_state'),state,'Forward function-only repair preserves all release state')
// New RPCs must be present in the reloaded schema cache before exercising them.
for(let attempt=0;;attempt++) {
  const response=await fetch(status.API_URL+'/',{headers:{authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}})
  const schema=await response.json()
  if(schema.paths?.['/rpc/release_history_import']) break
  assert.ok(attempt<50,'New history RPC did not enter the disposable schema cache');await delay(100)
}
if(process.env.RELEASE_HISTORY_DISPOSABLE==='1') {
  const before=await catalog('release_candidate_state')
  sql(`create function super_admin_private.fixture_skip_history_head() returns trigger language plpgsql as $$begin return null;end$$;
create trigger fixture_skip_history_head before update on public.release_candidate_versions for each row execute function super_admin_private.fixture_skip_history_head();`)
  await assert.rejects(catalog('release_history_import',{p_history:retrospectivePlan}),/HISTORICAL_BASELINE_REVIEW_REQUIRED/)
  assert.deepEqual(await catalog('release_candidate_state'),before)
  assert.equal(sql('select count(*) from public.release_retrospective_imports;'),'0')
  sql('drop trigger fixture_skip_history_head on public.release_candidate_versions;drop function super_admin_private.fixture_skip_history_head();')
  const imports=await Promise.all([0,1].map(()=>catalog('release_history_import',{p_history:retrospectivePlan})))
  assert.deepEqual(imports[0],imports[1],'Concurrent first imports retain one clock/digest and advance the baseline once')
  const imported=imports[0]
  assert.deepEqual(await catalog('release_history_import',{p_history:retrospectivePlan}),imported)
  assert.equal((await catalog('release_candidate_state')).baseVersions['shop-suit'],'0.4.0')
  const reserved=await catalog('release_candidate_refresh',{p_snapshot:{...snapshot,baseVersions:{'shop-suit':'0.4.0'}}})
  assert.equal(reserved.manifest.versions['shop-suit'],'0.5.0')
  await catalog('release_candidate_ready',{p_key:reserved.key,p_digest:reserved.digest})
  const response=await fetch(status.API_URL+'/rpc/release_public_feed',{method:'POST',headers:{authorization:`Bearer ${status.ANON_KEY}`,'content-type':'application/json'},body:'{}'})
  assert.equal(response.status,200)
  const feed=parseChangelogFeed(await response.json())
  assert.equal(feed.entries.filter(row=>row.status==='released'&&row.versionOrigin==='retrospective').length,4)
  assert.equal(feed.entries.filter(row=>row.status==='coming-soon').length,reserved.manifest.entries.length)
  await assert.rejects(catalog('release_history_import',{p_history:{...retrospectivePlan,baselineVersion:'9.0.0'}}),/HISTORY_IMPORT_REVIEW_REQUIRED/)
  const denied=createCatalog(`https://${ref}.supabase.co`,status.ANON_KEY,ref,transport)
  await assert.rejects(denied('release_history_import',{p_history:retrospectivePlan}),/HTTP (401|403)/)
  await catalog('release_candidate_acknowledge',{p_receipt:{...reserved,deploymentSha:'f'.repeat(40),publishedAt:new Date().toISOString()}})
  await catalog('release_history_import',{p_history:retrospectivePlan})
  assert.equal((await catalog('release_candidate_state')).baseVersions['shop-suit'],'0.5.0')
  assert.equal(sql('select count(*) from public.release_retrospective_imports;'),'1')
  await assert.rejects(catalog('release_candidate_unsafe'),/CANDIDATE_UPDATE_REQUIRES_WHERE/)
  assert.deepEqual(await catalog('release_candidate_safety'),{authenticatorSession:true,guardEnabled:true})
  console.log('Retrospective history passes actual authenticator/PostgREST with pg-safeupdate: atomic import, retry, suppression rollback, approved provenance, anonymous denial, unchanged real releases and baseline advancement without double credit')
} else {
// A legitimate update trigger that suppresses the row must remain effective.
sql(`create function super_admin_private.fixture_skip_pin() returns trigger language plpgsql as $$begin return null;end$$;
create trigger fixture_skip_pin before update on public.release_candidate_baseline for each row execute function super_admin_private.fixture_skip_pin();`)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:snapshot}),/PRODUCTION_BASELINE_CHANGED/)
assert.deepEqual(await catalog('release_candidate_state'),state,'Zero affected rows abort without overwriting/advertising state')
sql('drop trigger fixture_skip_pin on public.release_candidate_baseline;drop function super_admin_private.fixture_skip_pin();')
const first=await catalog('release_candidate_refresh',{p_snapshot:snapshot})
await assert.rejects(catalog('release_candidate_unsafe'),/CANDIDATE_UPDATE_REQUIRES_WHERE/)
assert.deepEqual(await catalog('release_candidate_safety'),{authenticatorSession:true,guardEnabled:true},'The safety gate remains active')
console.log('Qualified initial pin succeeds with guard still enabled; unqualified writes remain denied')

const readFeed=async()=>{
  const response=await fetch(status.API_URL+'/rpc/release_public_feed',{method:'POST',headers:{authorization:`Bearer ${status.ANON_KEY}`,'content-type':'application/json'},body:'{}',redirect:'error'})
  assert.equal(response.status,200,'A verified preview must remain readable throughout refresh/retry')
  return parseChangelogFeed(await response.json())
}
const initial=await fetch(status.API_URL+'/rpc/release_public_feed',{method:'POST',headers:{authorization:`Bearer ${status.ANON_KEY}`,'content-type':'application/json'},body:'{}',redirect:'error'})
assert.equal(initial.status,400,'First initialization still fails closed until readiness; no fake empty feed')
// Existing database controls may suppress an update; publication must then roll back and remain uninitialized.
sql(`create function super_admin_private.fixture_skip_ready() returns trigger language plpgsql as $$begin return null;end$$;
create trigger fixture_skip_ready before update on public.release_candidate_revisions for each row execute function super_admin_private.fixture_skip_ready();`)
await assert.rejects(catalog('release_candidate_ready',{p_key:first.key,p_digest:first.digest}),/STAGING_CANDIDATE_NOT_READY/)
assert.equal(sql('select count(*) from public.release_candidate_preview;'),'0')
assert.equal(sql('select count(*) from public.release_candidate_revisions where ready_at is not null;'),'0')
sql('drop trigger fixture_skip_ready on public.release_candidate_revisions;drop function super_admin_private.fixture_skip_ready();')
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
const second=await catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'e'.repeat(40)}})
assert.deepEqual((await readFeed()).entries,readyFeed.entries,'Full SAS/PostgREST preserves last-good notes while a newer candidate is unready')
await assert.rejects(catalog('release_candidate_ready',{p_key:first.key,p_digest:first.digest}))
await assert.rejects(catalog('release_candidate_ready',{p_key:second.key,p_digest:'0'.repeat(64)}))
assert.deepEqual((await readFeed()).entries,readyFeed.entries,'Superseded and invalid readiness do not swap the preview')
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
// Matching local fixture receipt exercises void acknowledgment under the same
// loaded authenticator gate; real promotion authorization is tested separately.
const accepted=await catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'d'.repeat(40)}})
await catalog('release_candidate_ready',{p_key:accepted.key,p_digest:accepted.digest})
const fixtureReceipt={...accepted,deploymentSha:'f'.repeat(40),publishedAt:new Date().toISOString()}
const beforeAck=await catalog('release_candidate_state')
const beforeAckFeed=await readFeed()
sql(`create function super_admin_private.fixture_skip_retirement() returns trigger language plpgsql as $$begin return null;end$$;
create trigger fixture_skip_retirement before insert or update on public.release_candidate_preview for each row execute function super_admin_private.fixture_skip_retirement();`)
await assert.rejects(catalog('release_candidate_acknowledge',{p_receipt:fixtureReceipt}),/STAGING_CANDIDATE_NOT_READY/)
assert.deepEqual(await catalog('release_candidate_state'),beforeAck,'Suppressed preview retirement rolls back acknowledgment, versions, receipt and baseline')
assert.deepEqual((await readFeed()).entries,beforeAckFeed.entries)
sql('drop trigger fixture_skip_retirement on public.release_candidate_preview;drop function super_admin_private.fixture_skip_retirement();')
await catalog('release_candidate_acknowledge',{p_receipt:fixtureReceipt})
const acknowledged=await catalog('release_candidate_state')
assert.equal(acknowledged.baseVersions['shop-suit'],'0.1.0')
assert.equal(acknowledged.promotions.length,1)
await catalog('release_candidate_acknowledge',{p_receipt:fixtureReceipt})
assert.equal((await catalog('release_candidate_state')).promotions.length,1)
assert.ok((await readFeed()).entries.every(row=>row.status==='released'),'Acknowledgment retires the preview atomically')
await catalog('release_candidate_refresh',{p_snapshot:snapshot})
await assert.rejects(catalog('release_candidate_ready',{p_key:accepted.key,p_digest:accepted.digest}))
assert.ok((await readFeed()).entries.every(row=>row.status==='released'),'Old refresh/readiness retries cannot resurrect an acknowledged preview')
const nextSnapshot={...snapshot,mainSha:fixtureReceipt.deploymentSha,mainTree:accepted.manifest.stagingTree,baseVersions:{'shop-suit':'0.1.0'},stagingSha:'8'.repeat(40),changes:[]}
const zero=await catalog('release_candidate_refresh',{p_snapshot:nextSnapshot})
await catalog('release_candidate_ready',{p_key:zero.key,p_digest:zero.digest})
const zeroFeed=await readFeed()
assert.ok(zeroFeed.entries.every(row=>row.status==='released'))
const successor=await catalog('release_candidate_refresh',{p_snapshot:{...nextSnapshot,stagingSha:'7'.repeat(40),changes:snapshot.changes}})
assert.deepEqual((await readFeed()).entries,zeroFeed.entries,'A ready net-zero preview is retained while its nonempty successor waits')
sql(`create function super_admin_private.fixture_skip_preview() returns trigger language plpgsql as $$begin return null;end$$;
create trigger fixture_skip_preview before insert or update on public.release_candidate_preview for each row execute function super_admin_private.fixture_skip_preview();`)
await assert.rejects(catalog('release_candidate_ready',{p_key:successor.key,p_digest:successor.digest}),/STAGING_CANDIDATE_NOT_READY/)
assert.deepEqual((await readFeed()).entries,zeroFeed.entries,'A suppressed preview write rolls back readiness and keeps the previous publication')
assert.equal(sql(`select ready_at is null from public.release_candidate_revisions where key='${successor.key}';`),'t')
sql('drop trigger fixture_skip_preview on public.release_candidate_preview;drop function super_admin_private.fixture_skip_preview();')
await catalog('release_candidate_ready',{p_key:successor.key,p_digest:successor.digest})
const successorFeed=await readFeed()
assert.ok(successorFeed.entries.some(row=>row.status==='coming-soon'))
await catalog('release_candidate_acknowledge',{p_receipt:fixtureReceipt})
assert.deepEqual((await readFeed()).entries,successorFeed.entries,'Replayed acknowledgment preserves a new ready preview')
await assert.rejects(catalog('release_candidate_unsafe'),/CANDIDATE_UPDATE_REQUIRES_WHERE/)
assert.deepEqual(await catalog('release_candidate_safety'),{authenticatorSession:true,guardEnabled:true})
console.log('Last-good preview survives unready refresh, supersession, update suppression, net-zero, acknowledgment and retries under pg-safeupdate')
console.log('Safeupdate remains enabled across refresh, readiness, public feed and idempotent fixture acknowledgment')
console.log('Full SAS PostgREST catalog passed: real createCatalog state/refresh, concurrent retry, invalid-ref denial, anonymous denial and unchanged production baseline/history and safe cardinality locations')

await assert.rejects(catalog('release_history_import',{p_history:retrospectivePlan}),/HISTORICAL_VERSION_COLLISION/)
assert.equal(sql('select count(*) from public.release_retrospective_imports;'),'0','A real existing version collision never rewrites history')
}

} finally {
  // Names are generated by this invocation; unrelated stacks/volumes are untouched.
  for(const name of [rest,db]) spawnSync('docker',['rm','-fv',name],{stdio:'ignore'})
  spawnSync('docker',['network','rm',network],{stdio:'ignore'})
}

// Every normal CI invocation also runs the import branch in its own independent disposable catalog.
if(process.env.RELEASE_HISTORY_DISPOSABLE!=='1') {
  const child=spawnSync(process.execPath,[process.argv[1]],{encoding:'utf8',env:{...process.env,RELEASE_HISTORY_DISPOSABLE:'1'},timeout:120000})
  if(child.status!==0) throw new Error('Disposable retrospective catalog failed; '+child.stderr)
  console.log(child.stdout.trim())
}
