import assert from 'node:assert/strict'
import { testBootstrap } from './bootstrap-disposable.mjs'
import { testCandidates } from './candidate-disposable.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { createChangelogClient } from '../../packages/data-access/src/changelog.ts'
import { filterChangelog, selectChangelogReleases, isChangelogNew } from '../../packages/contracts/src/changelog.ts'
import { spawnSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const outputArgs = process.argv.slice(2)
if (outputArgs.length && (outputArgs.length !== 2 || !['--public-feed','--candidate-feed'].includes(outputArgs[0]) || !outputArgs[1])) throw new Error('Expected optional --public-feed or --candidate-feed output path')
const container = `bs-release-test-${randomUUID()}`
function docker(args, input) {
  const result = spawnSync('docker',args,{input,encoding:'utf8',timeout:120000})
  if (result.status !== 0) throw new Error(result.stderr || 'Disposable Docker command failed')
  return result.stdout.trim()
}
function sql(statement) { return docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],statement) }
const quote = value => `'${String(value).replaceAll("'","''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const jwt = "set request.jwt.claims='{" + '"role":"service_role"' + "}';"
const one = '1'.repeat(40), two = '2'.repeat(40), three = '3'.repeat(40), anchor = '0'.repeat(40)
const copy = {en:'Easier account setup',ar:'إعداد الحساب بسهولة'}
const fragment = {id:'release-fixture-one',task:'BS-TEST-001',classification:'minor',disposition:'public',suits:['shop-suit'],paths:['apps/shop-suit'],reason:'A new capability',notes:{title:copy,summary:copy,details:copy}}
const request = (sha,parent,fragments) => ({repository:'Building-Suit/building-suit-monorepo',ref:'refs/heads/stg',sourceSha:sha,parentSha:parent,fragments})
const accept = row => JSON.parse(sql(`${jwt} select public.release_stage_accept(${json(row)});`).split('\n').at(-1))
const publish = (env,ref,rows) => JSON.parse(sql(`${jwt} select public.release_publish('${env}','refs/heads/${ref}','${three}',${json(rows)});`).split('\n').at(-1))
const fails = (statement, pattern) => assert.throws(()=>sql(statement),pattern)
async function parallelSql(statement, database = 'postgres') {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'])
    let out='',err='';child.stdout.on('data',value=>out+=value);child.stderr.on('data',value=>err+=value)
    child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err)));child.stdin.end(statement)
  })
}
try {
  docker(['run','-d','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
  for (let n=0;n<40;n++) { const ready=spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);if(ready.status===0)break;await new Promise(resolve=>setTimeout(resolve,250)) }
  sql(`create role anon;create role authenticated;create role service_role;create schema extensions;create extension pgcrypto with schema extensions;create schema super_admin_private;
  create table public.admin_environments(id uuid primary key,environment_kind text,status text);
  create table public.suit_registry(id uuid primary key,stable_key text unique,display_name jsonb,status text);
  insert into public.admin_environments values('00000000-0000-0000-0000-000000000001','staging','active');
  insert into public.suit_registry values('00000000-0000-0000-0000-000000000002','shop-suit','{"en":"Shop","ar":"المتجر"}','active');`)
  sql(readFileSync(new URL('../../apps/super-admin-suit/supabase/migrations/20261015030053_task_release_catalog.sql',import.meta.url),'utf8'))
  sql(`insert into public.release_catalog_configuration values(true,'00000000-0000-0000-0000-000000000001','Building-Suit/building-suit-monorepo','${anchor}','${anchor}');`)
  const a=request(one,anchor,[fragment])
  fails(`${jwt} select public.release_stage_accept(${json(a)});`,/VERIFIED_BASELINE_REQUIRED/)
  assert.equal(sql('select count(*) from public.release_manifests'),'0','Failed allocation is atomic')
  sql("insert into public.release_version_heads values('00000000-0000-0000-0000-000000000002','2.7.4','Verified historical release fixture');")
  const [first, retry]=await Promise.all([parallelSql(`${jwt} select public.release_stage_accept(${json(a)});`),parallelSql(`${jwt} select public.release_stage_accept(${json(a)});`)])
  const release=JSON.parse(first.split('\n').at(-1));assert.deepEqual(JSON.parse(retry.split('\n').at(-1)),release)
  assert.equal(release.manifest.versions['shop-suit'],'2.8.0');assert.equal(sql('select count(*) from public.release_versions'),'1')
  assert.deepEqual(accept(a),release,'Identical delivery returns saved outcome')
  fails(`${jwt} select public.release_stage_accept(${json({...a,fragments:[{...fragment,classification:'patch'}]})});`,/DIGEST_CONFLICT/)
  fails(`${jwt} select public.release_stage_accept(${json(request(two,anchor,[]))});`,/INVALID_PROVENANCE_OR_ORDER/)
  fails(`${jwt} select public.release_stage_accept(${json(request(two,one,[fragment]))});`,/FRAGMENT_ALREADY_CONSUMED/)
  fails(`${jwt} select public.release_stage_accept(${json({...request(two,one,[]),ref:'refs/heads/main'})});`,/INVALID_PROVENANCE/)
  for(const bad of [{...fragment,id:'malformed-copy',notes:{...fragment.notes,title:{en:'missing Arabic'}}},{...fragment,id:'bad-class',classification:null},{...fragment,id:'unknown-suit',suits:['unknown-suit']}]) fails(`${jwt} select public.release_stage_accept(${json(request(two,one,[bad]))});`,/INVALID_COPY|INVALID_FRAGMENT|UNREGISTERED_SUIT/)
  const internal={...fragment,id:'release-internal',classification:'internal',disposition:'internal'};delete internal.notes
  const internalRelease=accept(request(two,one,[internal]));assert.deepEqual(internalRelease.manifest.versions,{})
  const maxRelease=accept(request(three,two,[{...fragment,id:'major-change',classification:'major'},{...fragment,id:'patch-change',classification:'patch'}]))
  assert.equal(maxRelease.manifest.versions['shop-suit'],'3.0.0')
  // Several accepted staging releases, each with several curated fragments, ship in one promotion.
  let parent=three
  const additional=[]
  for (const [sha, count] of [['4'.repeat(40),2],['5'.repeat(40),3],['6'.repeat(40),2]]) {
    const notes=Array.from({length:count},(_,index)=>({...fragment,id:`batch-${sha[0]}-note-${index}`,classification:'patch'}))
    additional.push(accept(request(sha,parent,notes)));parent=sha
  }
  assert.deepEqual(JSON.parse(sql('select public.release_public_feed()')).entries,[],'Unready deployment advertises nothing')
  for (const role of ['anon','authenticated']) {
    fails(`set role ${role}; select public.release_stage_accept(${json(a)});`,/permission denied/)
    fails(`set role ${role}; select * from public.release_manifests;`,/permission denied/)
  }
  fails(`set role service_role;select public.release_catalog_state();`,/SERVER_REQUIRED/)
  fails(`${jwt} select public.release_publish('production','refs/heads/main','${three}',${json([release])});`,/WRONG_ENVIRONMENT/)
  fails(`${jwt} select public.release_publish('staging','refs/heads/stg','${three}',${json([{...release,digest:'a'.repeat(64)}])});`,/DIGEST_CONFLICT/)
  const missing={...release.manifest,sourceSha:'7'.repeat(40)}
  const missingDigest=sql(`select super_admin_private.release_digest(${json(missing)});`)
  fails(`${jwt} select public.release_publish('staging','refs/heads/stg','${three}',${json([{manifest:missing,digest:missingDigest,publishedAt:null}])});`,/MISSING_STAGING_MANIFEST/)
  publish('staging','stg',[release,internalRelease,maxRelease,...additional])
  const feed=JSON.parse(sql('set role anon;select public.release_public_feed();').split('\n').at(-1))
  assert.equal(feed.entries.length,10);for(const forbidden of ['BS-TEST','fragments','sourceSha','parentSha','paths','classification','baseline_evidence']) assert.ok(!JSON.stringify(feed).includes(forbidden),forbidden)
  const published=JSON.parse(sql(`${jwt} select public.release_catalog_state();`).split('\n').at(-1)).manifests
  const before=feed.entries[0].publishedAt;publish('staging','stg',published)
  assert.equal(JSON.parse(sql('select public.release_public_feed()')).entries[0].publishedAt,before)
  fails("update public.release_manifests set first_published_at=clock_timestamp();",/IMMUTABLE_RELEASE/)
  fails("update public.release_manifests set digest=repeat('b',64);",/IMMUTABLE_RELEASE/)
  // Separate disposable production database in the same container. No production allocation or shared tables.
  sql('create database release_production;')
  const prodSql = statement => docker(['exec','-i',container,'psql','-U','postgres','-d','release_production','-v','ON_ERROR_STOP=1','-At'],statement)
  prodSql(`create schema extensions;create extension pgcrypto with schema extensions;create schema super_admin_private;
    create table public.admin_environments(id uuid primary key,environment_kind text,status text);
    create table public.suit_registry(id uuid primary key,stable_key text unique,display_name jsonb,status text);
    insert into public.admin_environments values('00000000-0000-0000-0000-000000000001','production','active');
    insert into public.suit_registry values('00000000-0000-0000-0000-000000000002','shop-suit','{"en":"Shop","ar":"المتجر"}','active');`)
  prodSql(readFileSync(new URL('../../apps/super-admin-suit/supabase/migrations/20261015030053_task_release_catalog.sql',import.meta.url),'utf8'))
  prodSql(`insert into public.release_catalog_configuration values(true,'00000000-0000-0000-0000-000000000001','Building-Suit/building-suit-monorepo','${anchor}','${anchor}');`)
  const promote=rows=>prodSql(`${jwt}select public.release_publish('production','refs/heads/main','${three}',${json(rows)});`)
  assert.throws(()=>promote([published[2]]),/INVALID_PROMOTION_ORDER/)
  assert.throws(()=>promote([{...published[0],publishedAt:null}]),/STAGING_NOT_PUBLISHED/)
  assert.equal(prodSql('select count(*) from public.release_manifests'),'0')
  assert.throws(()=>promote([published[0],{...published[1],digest:'a'.repeat(64)}]),/DIGEST_CONFLICT/)
  assert.equal(prodSql('select count(*) from public.release_manifests'),'0','Partial production import rolls back completely')
  assert.equal(prodSql('select cursor_sha from public.release_catalog_configuration'),anchor)
  promote(published);promote(published)
  const prod=JSON.parse(prodSql(`${jwt}select public.release_catalog_state();`).split('\n').at(-1))
  assert.deepEqual(prod.manifests.map(r=>[r.manifest,r.digest]),published.map(r=>[r.manifest,r.digest]));assert.equal(prod.manifests.length,6)
  assert.notEqual(prod.manifests[0].publishedAt,published[0].publishedAt)
  assert.throws(()=>prodSql(`${jwt}select public.release_stage_accept(${json(a)});`),/WRONG_ENVIRONMENT/)
  const productionFeed=JSON.parse(prodSql('set role anon;select public.release_public_feed();').split('\n').at(-1))
  assert.equal(new Set(productionFeed.entries.map(row=>row.publishedAt)).size,1,'Batch publication has one immutable environment clock')
  const expectedVersions=['3.0.3','3.0.2','3.0.1','3.0.0','2.8.0']
  assert.deepEqual([...new Set(productionFeed.entries.map(row=>row.version))],expectedVersions,'Actual public RPC preserves release chronology')
  // Exercise the actual shared client and selector, including reordering the public response.
  const client=await createChangelogClient(async()=>({...productionFeed,entries:[...productionFeed.entries].reverse()})).list({suit:'shop-suit'})
  assert.deepEqual([...new Set(client.entries.map(row=>row.version))],expectedVersions)
  assert.deepEqual(filterChangelog(client).map(row=>row.id),client.entries.map(row=>row.id))
  const teaser=selectChangelogReleases(client,{suit:'shop-suit'},3)
  assert.deepEqual([...new Set(teaser.map(row=>row.version))],expectedVersions.slice(0,3))
  assert.equal(teaser.length,7,'Three distinct releases include all seven fragments, rather than three entries')
  assert.deepEqual(teaser.map(row=>row.publishedAt),Array(7).fill(productionFeed.entries[0].publishedAt))
  const expiry=new Date(Date.parse(productionFeed.entries[0].publishedAt)+48*60*60*1000).toISOString()
  assert.ok(teaser.every(row=>isChangelogNew(row,client.serverNow)&&!isChangelogNew(row,expiry)))
  for(const forbidden of ['BS-TEST','fragments','sourceSha','parentSha','paths','classification','digest','ordinal','baseline_evidence']) assert.ok(!JSON.stringify(productionFeed).includes(forbidden),forbidden)
  if(outputArgs[0] === '--public-feed') writeFileSync(outputArgs[1],JSON.stringify(productionFeed)+'\n')
  await testBootstrap({ sql, parallelDatabaseSql: (database, statement) => parallelSql(statement, database), databaseSql: (database, statement) => docker(['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'], statement),
    migration: new URL('../../apps/super-admin-suit/supabase/migrations/20261015212440_first_official_release_bootstrap.sql', import.meta.url) })
  await testCandidates({ outputPath: outputArgs[0] === '--candidate-feed' ? outputArgs[1] : undefined, sql, parallelDatabaseSql: (database, statement) => parallelSql(statement, database), databaseSql: (database, statement) => docker(['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'], statement) })
  console.log('Disposable PostgreSQL release acceptance passed: atomic allocation, concurrent retry, ordering, recovery, authorization, immutable timestamps, projection and batch promotion')
} finally { docker(['rm','-fv',container]) }
