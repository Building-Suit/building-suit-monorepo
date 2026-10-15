import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {parseChangelogFeed,isChangelogNew} from '../../packages/contracts/src/changelog.ts'
export async function testCandidates({sql,databaseSql,parallelDatabaseSql,outputPath}) {
  const migration=name=>readFileSync(new URL(`../../apps/super-admin-suit/supabase/migrations/${name}.sql`,import.meta.url),'utf8')
  const jwt=`set request.jwt.claims='{"role":"service_role"}';`
  const json=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`
  const parse=x=>JSON.parse(x.split('\n').at(-1))
  const setup=(name,kind,beforeModel)=>{
    sql(`create database ${name};`)
    const q=s=>databaseSql(name,s)
    q(`create schema extensions;create extension pgcrypto with schema extensions;create schema super_admin_private;
      create table public.admin_environments(id uuid primary key,stable_key text,environment_kind text,status text);
      create table public.suit_registry(id uuid primary key,stable_key text unique,display_name jsonb,status text);
      insert into public.admin_environments values('a0bb00a1-747c-4cda-8521-9927d0b53065','sas-staging','${kind}','active');
      insert into public.suit_registry values('7924a9af-a970-4360-a0d0-76df4e18dbfc','shop-suit','{"en":"Shop","ar":"المتجر"}','active');`)
    q(migration('20261015030053_task_release_catalog'))
    q(migration('20261015212440_first_official_release_bootstrap'))
    if(kind==='production') q(`insert into public.release_catalog_configuration values(true,'a0bb00a1-747c-4cda-8521-9927d0b53065','Building-Suit/building-suit-monorepo','${'a'.repeat(40)}','${'a'.repeat(40)}');`)
    if(beforeModel) beforeModel(q)
    q(migration('20261015215030_upcoming_release_candidates'))
    return q
  }
  const stage=setup('candidate_stage','staging'),prod=setup('candidate_prod','production')
  const copy={en:'Review upcoming work',ar:'مراجعة العمل القادم'}
  const change={id:'candidate-capability',task:'BS-TEST-001',suits:['shop-suit'],classification:'minor',disposition:'public',paths:['apps/shop-suit'],reason:'Customer capability',notes:{title:copy,summary:copy,details:copy}}
  const snapshot=(n,changes=[change],baseVersions={'shop-suit':'0.0.0'})=>({schemaVersion:2,stagingRef:'refs/heads/stg',productionRef:'refs/heads/main',repository:'Building-Suit/building-suit-monorepo',mainSha:'a'.repeat(40),mainTree:'b'.repeat(40),stagingSha:String(n).repeat(40),stagingTree:String(n+1).repeat(40),baseVersions,changes,provenance:{branchCommits:[{sha:'private-merge-audit-marker'}],fragmentDigests:[{id:'private-fragment-audit-marker'}]}})
  const refresh=s=>parse(stage(`${jwt}select public.release_candidate_refresh(${json(s)});`))
  const ready=r=>stage(`${jwt}select public.release_candidate_ready('${r.key}','${r.digest}');`)
  const state=q=>parse(q(`${jwt}select public.release_candidate_state();`))
  const feed=q=>parseChangelogFeed(parse(q('set role anon;select public.release_public_feed();')))
  assert.throws(()=>feed(stage),/CANDIDATE_RECONCILIATION_REQUIRED/,'Missing first reconciliation is unavailable, not loaded-empty success')
  const first=snapshot(1)
  assert.throws(()=>refresh({...first,stagingRef:'refs/heads/main'}),/WRONG_REFERENCE/)
  assert.throws(()=>prod(`${jwt}select public.release_candidate_refresh(${json(first)});`),/WRONG_ENVIRONMENT/)
  assert.throws(()=>stage('set role service_role;select public.release_candidate_state();'),/SERVER_REQUIRED/)

  const retry=await Promise.all([0,1].map(()=>parallelDatabaseSql('candidate_stage',`${jwt}select public.release_candidate_refresh(${json(first)});`)))
  assert.deepEqual(parse(retry[0]),parse(retry[1]))
  const one=refresh(first)
  assert.equal(one.manifest.versions['shop-suit'],'0.1.0')
  assert.equal(state(stage).baseVersions['shop-suit'],'0.0.0','Preview never consumes a version')
  assert.throws(()=>feed(stage),/STAGING_CANDIDATE_NOT_READY/,'Failed/unready deployment stays explicitly unavailable')
  ready(one)
  const upcoming=feed(stage)
  assert.equal(upcoming.entries[0].status,'coming-soon')
  assert.equal(upcoming.entries[0].targetVersion,'0.1.0')
  assert.equal(upcoming.entries[0].version,undefined)
  assert.equal(isChangelogNew(upcoming.entries[0],upcoming.serverNow),false)
  assert.throws(()=>refresh({...first,changes:[{...change,notes:{...change.notes,title:{en:'changed copy',ar:'نص مختلف'}}}]}),/DIGEST_CONFLICT/)
  const two=refresh(snapshot(2,[change,{...change,id:'candidate-fix',classification:'patch'}]))
  assert.equal(two.manifest.versions['shop-suit'],'0.1.0','Repeated PR updates stay within the same net release')
  assert.throws(()=>feed(stage),/STAGING_CANDIDATE_NOT_READY/)
  ready(two)
  assert.equal(feed(stage).entries.length,2)
  assert.equal(new Set(feed(stage).entries.map(e=>e.targetVersion)).size,1)
  assert.equal(state(stage).baseVersions['shop-suit'],'0.0.0')
  const beforeFailure=stage('select count(*) from public.release_candidate_revisions;')
  assert.throws(()=>refresh(snapshot(3,[{...change,suits:['ledger-suit']} ])),/UNREGISTERED_SUIT/)
  assert.throws(()=>refresh(snapshot(3,[{...change,notes:{title:{en:'no Arabic'},summary:copy,details:copy}}])),/INVALID_COPY/)
  assert.equal(stage('select count(*) from public.release_candidate_revisions;'),beforeFailure)
  const zero=refresh(snapshot(3,[]));ready(zero)
  assert.deepEqual(zero.manifest.versions,{})
  assert.deepEqual(feed(stage).entries,[],'Net zero/reverts remove the upcoming public release, retaining every revision')
  const final=refresh(snapshot(4,[change,{...change,id:'candidate-fix',classification:'patch'}]));ready(final)
  const exported=state(stage).revisions.find(r=>r.key===final.key)
  const promote=r=>parse(prod(`${jwt}select public.release_candidate_promote(${json(r)},'${'9'.repeat(40)}','${first.mainSha}','${final.manifest.stagingTree}');`))
  assert.throws(()=>promote({...exported,readyAt:null}),/UNREADY_OR_WRONG_PROMOTION_PROVENANCE/)
  assert.throws(()=>promote({...exported,digest:'0'.repeat(64)}),/DIGEST_CONFLICT/)
  assert.equal(prod('select count(*) from public.release_candidate_promotions;'),'0')
  const badEntries={...exported.manifest,entries:[{...exported.manifest.entries[0],title:{en:'Forged projection',ar:'إسقاط مزور'}}]}
  const badDigest=prod(`select super_admin_private.release_digest(${json(badEntries)});`)
  assert.throws(()=>promote({...exported,manifest:badEntries,digest:badDigest}),/INVALID_GENERATED_ENTRIES/)
  assert.equal(prod('select count(*) from public.release_candidate_versions;'),'0','A failed freeze also rolls back first-production baseline adoption')
  const receipt=promote(exported)
  assert.deepEqual(promote(exported),receipt)
  assert.equal(feed(prod).entries.length,2,'Exactly one production release, with multiple readable items')
  assert.deepEqual([...new Set(feed(prod).entries.map(e=>e.version))],['0.1.0'])
  assert.equal(new Set(feed(prod).entries.map(e=>e.publishedAt)).size,1)
  assert.equal(prod('select count(*) from public.release_manifests;'),'0','No invented per-merge history')
  assert.throws(()=>stage(`${jwt}select public.release_candidate_acknowledge(${json({...receipt,digest:'0'.repeat(64)})});`),/MISSING_EXACT_CANDIDATE_RECEIPT/)
  assert.equal(state(stage).baseVersions['shop-suit'],'0.0.0','Production committed while a failed acknowledgment leaves staging recoverable')
  stage(`${jwt}select public.release_candidate_acknowledge(${json(receipt)});`)
  stage(`${jwt}select public.release_candidate_acknowledge(${json(receipt)});`)
  assert.equal(state(stage).baseVersions['shop-suit'],'0.1.0')
  assert.deepEqual(feed(stage).entries,feed(prod).entries,'Staging receives the exact frozen production receipt')
  const next=refresh({...snapshot(6,[{...change,classification:'patch'}],{'shop-suit':'0.1.0'}),mainSha:'9'.repeat(40)})
  assert.equal(next.manifest.versions['shop-suit'],'0.1.1','Fresh candidate starts from actual released production version')
  ready(next)
  assert.equal(feed(stage).entries.filter(e=>e.status==='coming-soon').length,1)
  assert.equal(feed(prod).entries.length,2)
  const published=feed(prod).entries[0].publishedAt
  assert.equal(isChangelogNew(feed(prod).entries[0],new Date(Date.parse(published)+48*60*60*1000).toISOString()),false)
  assert.throws(()=>prod(`update public.release_candidate_promotions set first_published_at=clock_timestamp();`),/IMMUTABLE_CANDIDATE_HISTORY/)
  assert.throws(()=>stage(`${jwt}select public.release_stage_accept('{}');`),/PER_MERGE_RELEASES_RETIRED/)
  assert.throws(()=>stage("update public.release_version_heads set version='9.9.9';"),/PER_MERGE_RELEASES_RETIRED/)
  assert.throws(()=>stage(`insert into public.release_manifests(source_sha) values('${'f'.repeat(40)}');`),/PER_MERGE_RELEASES_RETIRED/,'Table guards also stop a cached old writer after model adoption')
  for(const role of ['anon','authenticated']) {
    assert.throws(()=>stage(`set role ${role};select public.release_candidate_refresh(${json(first)});`),/permission denied/)
    assert.throws(()=>stage(`set role ${role};select * from public.release_candidate_revisions;`),/permission denied/)
  }
  for(const field of ['baseVersions','mainSha','stagingSha','digest','task','paths','BS-TEST','provenance','branchCommits','fragmentDigests','private-merge-audit-marker','private-fragment-audit-marker']) assert.ok(!JSON.stringify(feed(stage)).includes(field))
  assert.deepEqual(refresh(first),{...one,readyAt:state(stage).revisions.find(r=>r.key===one.key).readyAt},'An old identical revision retry after promotion returns its retained outcome without resurrecting it')
  if(outputPath) writeFileSync(outputPath,JSON.stringify(feed(stage))+'\n')
  assert.equal(stage('select version from public.release_version_heads;'),'0.0.0','Original v1 baseline/history remain unchanged')
  let priorLegacy
  const legacy=setup('candidate_existing_legacy','staging',q=>{
    const oldRequest={repository:'Building-Suit/building-suit-monorepo',ref:'refs/heads/stg',parentSha:'4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c',sourceSha:'e'.repeat(40),fragments:[change]}
    const accepted=parse(q(`${jwt}select public.release_stage_accept(${json(oldRequest)});`))
    q(`${jwt}select public.release_publish('staging','refs/heads/stg','${'e'.repeat(40)}',${json([accepted])});`)
    priorLegacy=q(`${jwt}select public.release_catalog_state();`)
  })
  assert.equal(legacy(`${jwt}select public.release_catalog_state();`),priorLegacy,'Model migration preserves every old immutable manifest, cursor, copy and publication time')
  assert.equal(legacy('select count(*) from public.release_candidate_versions;'),'0','Published legacy history is not guessed as a zero baseline')
  assert.throws(()=>legacy(`${jwt}select public.release_candidate_refresh(${json(first)});`),/VERIFIED_PRODUCTION_BASELINE_REQUIRED/)
  assert.throws(()=>feed(legacy),/LEGACY_RELEASE_HISTORY_REVIEW_REQUIRED/,'Unknown old staging publication cannot masquerade as verified production history or empty success')
  console.log('Upcoming candidate PostgreSQL passed: repeated updates, net-zero, one production freeze, retry/ack recovery, immutable history, next candidate, authorization and public boundaries')
}
