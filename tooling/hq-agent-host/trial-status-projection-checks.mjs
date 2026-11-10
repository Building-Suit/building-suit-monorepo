/** Whole-response oracle checks on disposable generated evidence, never hosted data. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { root, worker } from './public-repository-db-fixture.mjs'
import { evidence } from './claim-query-budget-checks.mjs'
export const statusMigration='20261110140432_hq_trial_status_projection.sql'
const signatures=['hq_private.workforce_trial_status()','hq_private.workforce_trial_status_before_public_retail()']
async function definitions(db){return(await db.query('select pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[]) order by oid',[signatures])).rows.map(r=>r.definition+';').join('\n')}
export async function tenWorkerFixture(f){
 const {h,configured}=f
 await h.db.exec('reset role')
 await h.db.exec(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
  select 'synthetic_status_unrelated_'||i,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Unrelated synthetic source','text/markdown','1',false,false from generate_series(1,500) i`)
 for(const [department,manager,id] of [
  ['research-market-intelligence','AG-RES-001','AG-RES-002'],
  ['customer-acquisition-partnerships','AG-SALES-001','AG-SALES-002'],
  ['customer-success-onboarding','AG-CS-001','AG-CS-002'],
  ['social-community','AG-SOC-001','AG-SOC-002'],
  ['email-lifecycle','AG-EMAIL-001','AG-EMAIL-002'],
 ]){
  const profile='synthetic_status_profile_'+id,skill='synthetic_status_skill_'+id
  await h.db.exec('reset role')
  for(const file of [profile,skill])await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
    values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic status source','text/markdown','1',false,true)`,[file])
  configured.push({id,name:'Synthetic status '+id,role:'Fixture',departmentKey:department,profileFileId:profile,skillFileIds:[skill],lifecycle:'configured trial pending',model:'gpt-6.1-terra',effort:'medium',managerId:manager,modelTier:'T1_WORKER'})
 }
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 await h.db.exec('reset role')
}
export async function verifyStatusProjection(h,{report=()=>{},qualifiedRepository=false}={}){
 const {db}=h
 await db.exec('reset role')
 const preserved=await evidence(db),original=await definitions(db)
 const metadata=async()=>(await db.query(`select oid,proowner,provolatile,prosecdef,proconfig,proacl,proparallel,proleakproof,proisstrict,procost,prorows,proargtypes,proargnames,prorettype,prokind,proretset from pg_proc where oid=any($1::regprocedure[]) order by oid`,[signatures])).rows
 const before=await metadata(),migration=await readFile(new URL(statusMigration,root),'utf8')
 for(const sig of signatures){
  await db.exec('begin')
  try{
   await db.exec(`create or replace function ${sig} returns jsonb language plpgsql stable security definer set search_path='' as $$begin return '[]'::jsonb;end$$`)
   await assert.rejects(db.exec(migration),/HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH/)
  }finally{await db.exec('rollback')}
 }
 const status=async()=>{await h.as('founder');return h.rpc('hq_workforce_trial_status')}
 const baselineStart=performance.now(),baseline=await status(),baselineMs=performance.now()-baselineStart
 assert.equal(baseline.length,10)
 assert.ok(baseline.find(r=>r.agentId==='AG-RES-002').publicResearch)
 assert.ok(baseline.find(r=>r.agentId==='AG-RES-002').publicRetail)
 if(qualifiedRepository)assert.equal(baseline.find(r=>r.agentId==='AG-DEV-002').repository.qualified,true)
 await db.exec('reset role');await db.exec(migration)
 const candidate=await definitions(db)
 assert.deepEqual(await metadata(),before,'existing private/public identity, ACL and execution contract remain')
 const candidateStart=performance.now();assert.deepEqual(await status(),baseline);const candidateMs=performance.now()-candidateStart
 const mutations=[
  ['disabled',"update hq_private.agent_roster set enabled=false where id='AG-DEV-004'"],
  ['model',"update hq_private.agent_roster set model='changed-test-model' where id='AG-DEV-004'"],
  ['effort',"update hq_private.agent_roster set effort='low' where id='AG-DEV-004'"],
  ['manager disabled',"update hq_private.agent_roster set enabled=false where id='AG-DEV-001'"],
  ['reviewer disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-003'"],
  ['department',"update hq_private.agent_roster set department_key='research-market-intelligence' where id='AG-DEV-004'"],
  ['tier',"update hq_private.agent_roster set model_tier='T2_HEAD' where id='AG-DEV-004'"],
  ...['configured','candidate','trial','pending','suspended','inactive','retired','terminated','archived','paused','testing-only'].map(l=>['lifecycle '+l,`update hq_private.agent_roster set lifecycle='${l}' where id='AG-DEV-004'`]),
  ['profile trashed',"update hq_private.brain_files set trashed=true,in_scope=false where file_id='synthetic_developer_profile_2'"],
  ['profile version',"update hq_private.brain_files set source_version='2' where file_id='synthetic_developer_profile_2'"],
  ['skill version',"update hq_private.brain_files set source_version='2' where file_id='synthetic_repository_ci_skill'"],
  ['skill out of scope',"update hq_private.brain_files set in_scope=false where file_id='synthetic_repository_ci_skill'"],
  ['skill missing version',"update hq_private.brain_files set source_version=null where file_id='synthetic_repository_ci_skill'"],
  ['unindexed first skill',`update hq_private.agent_roster set skill_file_ids='["aaaaaaaa_missing_source","synthetic_repository_ci_skill"]' where id='AG-DEV-004'`],
  ['duplicate skills',`update hq_private.agent_roster set skill_file_ids='["synthetic_repository_ci_skill","synthetic_repository_ci_skill"]' where id='AG-DEV-004'`],
  ['skill trashed',"update hq_private.brain_files set trashed=true,in_scope=false where file_id='synthetic_repository_ci_skill'"],
  ['empty skills',"update hq_private.agent_roster set skill_file_ids='[]' where id='AG-DEV-004'"],
  ['failed trial',"update hq_private.workforce_trials set status='failed' where agent_id='AG-DEV-004' and status='passed'"],
  ['rejected review',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id in(select review_job_id from hq_private.workforce_trials where agent_id='AG-DEV-004')`],
  ['research profile stale',"update hq_private.brain_files set source_version=null where file_id='synthetic_status_profile_AG-RES-002'"],
  ['research retired',"update hq_private.agent_roster set lifecycle='retired' where id='AG-RES-002'"],
 ]
 for(const [name,mutation]of mutations){
  await db.exec('reset role;begin')
  try{
   await db.exec(mutation);await db.exec(original);const old=await status()
   await db.exec('reset role');await db.exec(candidate);assert.deepEqual(await status(),old,name+' complete JSON parity')
  }finally{await db.exec('rollback;reset role')}
 }
 for(const mutation of ["delete from auth.sessions where user_id=(select user_id from public.hq_founders limit 1)","update public.hq_founders set revoked_at=clock_timestamp()","update hq_private.founder_invitations set revoked_at=clock_timestamp()"]){
  await db.exec('reset role;begin')
  try{await db.exec(mutation);await assert.rejects(status(),error=>error.code==='42501')}finally{await db.exec('rollback;reset role')}
 }
 await h.as('worker');await assert.rejects(h.rpc('hq_workforce_trial_status'),error=>error.code==='42501')
 for(const role of ['anon','service_role']){
  await db.exec('reset role;set role '+role)
  try{await assert.rejects(db.query('select public.hq_workforce_trial_status()'),error=>error.code==='42501')}finally{await db.exec('reset role')}
 }
 // Instrument only this disposable database to count authoritative evaluations.
 // A sequence remains visible across the read-only statement snapshots. Rollback
 // restores the exact function and removes the instrument, never shipping a cache.
 await db.exec('begin')
 try{
  const predicate=(await db.query("select pg_get_functiondef('hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure) definition")).rows[0].definition
  await db.exec(predicate.replace('FUNCTION hq_private.workforce_skill_evidence_valid(', 'FUNCTION hq_private.status_fixture_evidence('))
  await db.exec(`create sequence hq_private.status_fixture_evaluations;
    create or replace function hq_private.workforce_skill_evidence_valid(p_agent_id text,p_skill_file_id text) returns boolean language plpgsql volatile security definer set search_path='' as $$begin perform nextval('hq_private.status_fixture_evaluations');return hq_private.status_fixture_evidence(p_agent_id,p_skill_file_id);end$$`)
  await db.exec(original);await status();await db.exec('reset role')
  const baselineCalls=Number((await db.query('select last_value from hq_private.status_fixture_evaluations')).rows[0].last_value)
  await db.exec(candidate);await db.query("alter sequence hq_private.status_fixture_evaluations restart with 1")
  await status();await db.exec('reset role')
  const calls=Number((await db.query('select last_value from hq_private.status_fixture_evaluations')).rows[0].last_value)
  const pairs=Number((await db.query("select sum(jsonb_array_length(skill_file_ids)) n from hq_private.agent_roster where enabled and model_tier='T1_WORKER'")).rows[0].n)
  if(!qualifiedRepository)assert.equal(calls,pairs,'one evidence predicate per assigned skill before nested repository proof checks')
  assert.ok(calls<baselineCalls,'reuses ordinary evidence without skipping nested repository validation')
  report({baselineMs,candidateMs,mutations:mutations.length,workers:baseline.length,baselineEvidenceCalls:baselineCalls,evidenceCalls:calls,qualifiedRepository})
 }finally{await db.exec('rollback;reset role')}
 await db.exec('begin')
 try{
  const warm={}
  for(const [name,definition]of [['baseline',original],['candidate',candidate]]){
   await db.exec('reset role');await db.exec(definition);await status();warm[name]=[]
   for(let i=0;i<3;i++){const start=performance.now();await status();warm[name].push(performance.now()-start)}
  }
  report({warmStatusMs:warm,observationsOnly:true})
 }finally{await db.exec('rollback;reset role')}
 assert.deepEqual(await evidence(db),preserved,'projection never rewrites immutable evidence')
}
