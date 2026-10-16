// Full migrated SAS + real PostgREST, local-only; no keys or error bodies logged.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID, createHmac } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { buildCandidate } from './candidate.mjs'
import { createCatalog } from './publisher.mjs'
assert.equal(process.env.RELEASE_POSTGREST_DISPOSABLE, '1', 'Explicit disposable validation required')
function command(program, args, input) {
  const result=spawnSync(program,args,{input,encoding:'utf8',timeout:120000})
  if(result.status!==0) throw new Error(`Disposable command failed (exit ${result.status}; SQLSTATE ${result.stderr.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1] ?? 'UNKNOWN'}); credentials and raw errors omitted`)
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
for(const name of names) {
  console.log(`Apply SAS migration ${name}`)
  sql(readFileSync(new URL(name,migrations),'utf8'))
  if(name.startsWith('20261015030053')) {
sql(`insert into public.admin_environments(id,stable_key,environment_kind,display_name,status) values('a0bb00a1-747c-4cda-8521-9927d0b53065','sas-staging','staging','{}','active');
insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status) values('7924a9af-a970-4360-a0d0-76df4e18dbfc','shop-suit','{}','/brand/fixture.svg','1.0','active');
`)
  }
}
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
const snapshot={...buildCandidate('origin/main','HEAD'),baseVersions:state.baseVersions}
const first=await catalog('release_candidate_refresh',{p_snapshot:snapshot})
const retries=await Promise.all([0,1].map(()=>catalog('release_candidate_refresh',{p_snapshot:snapshot})))
assert.ok(retries.every(row=>row.key===first.key&&row.digest===first.digest))
assert.equal(first.manifest.versions['shop-suit'],'0.1.0')
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,productionRef:'refs/heads/stg'}}),/DIGEST_CONFLICT/)
await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{...snapshot,stagingSha:'f'.repeat(40),productionRef:'refs/heads/stg'}}),/WRONG_REFERENCE/)
const denied=createCatalog(`https://${ref}.supabase.co`,status.ANON_KEY,ref,transport)
await assert.rejects(denied('release_candidate_refresh',{p_snapshot:snapshot}),/HTTP (401|403)/)
assert.equal(sql('select count(*) from public.release_candidate_revisions;'),'1')
assert.equal(sql('select count(*) from public.release_candidate_promotions;'),'0')
assert.equal(sql('select version from public.release_candidate_versions;'),'0.0.0')
console.log('Full SAS PostgREST catalog passed: real createCatalog state/refresh, concurrent retry, invalid-ref denial, anonymous denial and unchanged production baseline/history')

} finally {
  // Names are generated by this invocation; unrelated stacks/volumes are untouched.
  for(const name of [rest,db]) spawnSync('docker',['rm','-fv',name],{stdio:'ignore'})
  spawnSync('docker',['network','rm',network],{stdio:'ignore'})
}
