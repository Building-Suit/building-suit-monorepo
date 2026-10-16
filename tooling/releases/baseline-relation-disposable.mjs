import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

export async function testBaselineRelationRepair({ sql, databaseSql }) {
  const migration=name=>readFileSync(new URL(`../../apps/super-admin-suit/supabase/migrations/${name}.sql`,import.meta.url),'utf8')
  const repair=migration('20261016130037_canonical_release_baseline_relation')
  const jwt=`set request.jwt.claims='{"role":"service_role"}';`
  const json=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
  const parse=value=>JSON.parse(value.split('\n').at(-1))
  const request={schemaVersion:2,repository:'Building-Suit/building-suit-monorepo',stagingRef:'refs/heads/stg',productionRef:'refs/heads/main',mainSha:'a'.repeat(40),mainTree:'b'.repeat(40),stagingSha:'c'.repeat(40),stagingTree:'d'.repeat(40),baseVersions:{'shop-suit':'0.0.0'},changes:[],provenance:{}}
  const setup=(name,kind='staging')=>{
    sql(`create database ${name};`)
    const q=statement=>databaseSql(name,statement)
    q(`create schema extensions;create extension pgcrypto with schema extensions;create schema super_admin_private;
create table public.admin_environments(id uuid primary key,stable_key text,environment_kind text,status text);
create table public.suit_registry(id uuid primary key,stable_key text unique,display_name jsonb,status text);
insert into public.admin_environments values('a0bb00a1-747c-4cda-8521-9927d0b53065','sas-staging','${kind}','active');
insert into public.suit_registry values('7924a9af-a970-4360-a0d0-76df4e18dbfc','shop-suit','{}','active');`)
    for(const file of ['20261015030053_task_release_catalog','20261015212440_first_official_release_bootstrap']) q(migration(file))
    if(kind==='production') q(`insert into public.release_catalog_configuration values(true,'a0bb00a1-747c-4cda-8521-9927d0b53065','Building-Suit/building-suit-monorepo',repeat('a',40),repeat('a',40));`)
    else q(`insert into public.release_manifests(source_sha,request,manifest,digest) values(repeat('f',40),'{}','{}',repeat('f',64));
insert into public.release_consumed_fragments values('retained-private-fragment',repeat('f',40),repeat('f',64));`)
    for(const file of ['20261015215030_upcoming_release_candidates','20261016112949_release_cardinality_location','20261016122230_release_refresh_statement_evidence']) q(migration(file))
    if(kind==='production') q(`insert into public.release_candidate_baseline values(true,repeat('a',40));`)
    else for(const [index,sha] of ['d','e'].entries()) {
      const prior={...request,stagingSha:sha.repeat(40)}
      q(`insert into public.release_candidate_revisions(key,request,manifest,digest) values('${String(index+1).repeat(64)}',${json(prior)},${json({...prior,versions:{},entries:[]})},repeat('a',64));`)
    }
    return q
  }
  const snapshot=q=>q(`select jsonb_build_object(
'baseline',(select to_jsonb(b) from public.release_candidate_baseline b),
'configuration',(select jsonb_agg(c) from public.release_catalog_configuration c),
'pointer',(select jsonb_agg(p) from public.release_candidate_pointer p),
'legacyVersions',(select jsonb_agg(v order by suit_id,version) from public.release_versions v),
'heads',(select jsonb_agg(h order by suit_id) from public.release_version_heads h),
'legacy',(select jsonb_agg(m order by source_sha) from public.release_manifests m),
'consumed',(select jsonb_agg(f order by fragment_id) from public.release_consumed_fragments f),
'versions',(select jsonb_agg(v order by suit_id) from public.release_candidate_versions v),
'revisions',(select jsonb_agg(r order by key) from public.release_candidate_revisions r),
'promotions',(select jsonb_agg(p order by revision_key) from public.release_candidate_promotions p));`)
  for(const mode of ['trigger','rule','constraint']) {
    const q=setup(`baseline_${mode}`)
    q(`create function super_admin_private.fixture_baseline_guard() returns boolean language plpgsql as $$begin return (select value from (values(true),(false)) v(value));end$$;`)
    if(mode==='trigger') q(`create function super_admin_private.fixture_baseline_trigger() returns trigger language plpgsql as $$begin perform super_admin_private.fixture_baseline_guard();return new;end$$;
create trigger fixture_baseline_guard before update on public.release_candidate_baseline for each row execute function super_admin_private.fixture_baseline_trigger();`)
    if(mode==='rule') q(`create table super_admin_private.fixture_rule_sink(value boolean);
create rule fixture_baseline_guard as on update to public.release_candidate_baseline do also insert into super_admin_private.fixture_rule_sink select super_admin_private.fixture_baseline_guard();`)
    if(mode==='constraint') q(`alter table public.release_candidate_baseline add constraint fixture_baseline_guard check(production_sha is null or super_admin_private.fixture_baseline_guard());`)
    const before=snapshot(q),oid=q("select 'public.release_candidate_baseline'::regclass::oid;")
    assert.equal(parse(q(`${jwt}select public.release_candidate_state();`)).productionSha,null)
    assert.throws(()=>q(`${jwt}select public.release_candidate_refresh(${json(request)});`),/CANDIDATE_CARDINALITY_BASELINE_PIN/,mode)
    assert.equal(snapshot(q),before,'Failed pin must roll back without history or baseline changes')
    q(repair)
    assert.equal(snapshot(q),before,'Repair preserves the complete logical release state')
    assert.equal(q("select 'super_admin_private.release_candidate_baseline_before_relation_repair'::regclass::oid;"),oid,'Original relation is retained, not dropped')
    const release=parse(q(`${jwt}select public.release_candidate_refresh(${json(request)});`))
    assert.ok(release.key)
    assert.equal(parse(q(`${jwt}select public.release_candidate_state();`)).productionSha,request.mainSha)
    assert.equal(q('select production_sha is null from super_admin_private.release_candidate_baseline_before_relation_repair;'),'t')
    assert.equal(q('select count(*) from public.release_candidate_revisions;'),'3')
    assert.equal(q('select count(*) from public.release_candidate_promotions;'),'0')
    assert.equal(q('select version from public.release_candidate_versions;'),'0.0.0')
    for(const role of ['anon','authenticated','service_role']) {
      assert.throws(()=>q(`set role ${role};select * from public.release_candidate_baseline;`),/permission denied/)
      assert.throws(()=>q(`set role ${role};select * from super_admin_private.release_candidate_baseline_before_relation_repair;`),/permission denied/)
    }
  }
  const pinned=setup('baseline_pinned')
  const accepted=parse(pinned(`${jwt}select public.release_candidate_refresh(${json(request)});`))
  const pinnedBefore=snapshot(pinned)
  pinned(repair)
  assert.equal(snapshot(pinned),pinnedBefore,'A legitimately pinned SHA and existing accepted candidate remain unchanged')
  assert.equal(parse(pinned(`${jwt}select public.release_candidate_refresh(${json(request)});`)).digest,accepted.digest)
  assert.equal(pinned('select production_sha from super_admin_private.release_candidate_baseline_before_relation_repair;'),request.mainSha)
  const dependency=setup('baseline_dependency'),before=snapshot(dependency)
  dependency('create view super_admin_private.fixture_baseline_consumer as select * from public.release_candidate_baseline;')
  assert.throws(()=>dependency(repair),/RELEASE_BASELINE_DEPENDENCY_REVIEW_REQUIRED/)
  assert.equal(snapshot(dependency),before)
  const production=setup('baseline_production','production'),productionBefore=snapshot(production)
  production(repair)
  assert.equal(snapshot(production),productionBefore,'Production is an explicit no-op')
  assert.equal(production("select to_regclass('super_admin_private.release_candidate_baseline_before_relation_repair') is null;"),'t')
  console.log('Baseline repair PostgreSQL passed: reproduced BASELINE_PIN for trigger/rule/constraint, preserved complete history and original relations, successful pin/retry, dependency denial and production no-op')
}
