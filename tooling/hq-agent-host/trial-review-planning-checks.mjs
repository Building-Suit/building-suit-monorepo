/** Real generated evidence in a disposable database, never hosted records. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { root, worker, scopeWork, delivery, entryFor, output, finishReviews } from './public-repository-db-fixture.mjs'
import { tenWorkerFixture, statusMigration } from './trial-status-projection-checks.mjs'
import { evidence } from './claim-query-budget-checks.mjs'
export const reviewPlanningMigration='20261110160612_hq_trial_review_planning.sql'
export const reviewSignature='hq_private.trial_review_ready(uuid)'
export const latestOrdinary=`select distinct on(a.id) a.id as agent_id,t.id as trial_id,t.status,t.purpose,a.lifecycle
 from hq_private.agent_roster a join hq_private.workforce_trials t on t.agent_id=a.id
 where a.enabled and a.model_tier='T1_WORKER' and t.purpose in('synthetic-internal-trial-v1','evaluator-skill-trial-v1')
 order by a.id,t.created_at desc,t.id desc`
export async function trialReviewFixture(f){
 const {h,configured,roleClaim}=f
 await tenWorkerFixture(f)
 // Existing fixture provides three genuinely qualified developers and evaluator.
 // Complete the other five ordinary worker trials through actual RPC/review paths.
 for(const id of ['AG-RES-002','AG-SALES-002','AG-CS-002','AG-SOC-002','AG-EMAIL-002']){
  const a=configured.find(row=>row.id===id)
  const work=await scopeWork(h,roleClaim,'hq_begin_supervised_worker_trial',[id,a.skillFileIds[0],randomUUID()],id,a.managerId)
  await delivery(h,entryFor(work.j,await output(work.j)));await finishReviews(h,roleClaim,a.managerId)
  await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[work.trial.trialId])
  a.lifecycle='Active / Qualified'
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 }
 const canceled=configured.find(row=>row.id==='AG-HR-002'),skill='synthetic_canceled_trial_skill'
 await h.db.exec('reset role')
 await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
  values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic canceled trial skill','text/markdown','1',false,true)`,[skill])
 canceled.skillFileIds=[skill]
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 await h.as('founder');const trial=await h.rpc('hq_begin_supervised_worker_trial',[canceled.id,skill,randomUUID()])
 await h.rpc('hq_cancel_task',[trial.taskId])
 // The baseline fixture's historical cancellation RPC does not yet update trial
 // labels. This disposable state models the observed canceled latest trial only.
 await h.db.exec('reset role')
 await h.db.query("update hq_private.workforce_trials set status='canceled',completed_at=null where id=$1",[trial.trialId])
 for(const file of ['20261110002441_hq_skill_evidence_plan_reuse.sql',statusMigration])await h.db.exec(await readFile(new URL(file,root),'utf8'))
 const latest=(await h.db.query(latestOrdinary)).rows
 assert.equal(latest.length,10)
 assert.equal(latest.filter(row=>row.status==='passed'&&row.purpose==='synthetic-internal-trial-v1'&&row.lifecycle==='Active / Qualified').length,8)
 assert.equal(latest.filter(row=>row.status==='passed'&&row.purpose==='evaluator-skill-trial-v1').length,1)
 assert.equal(latest.filter(row=>row.status==='canceled').length,1)
 return latest
}
export async function reviewDefinition(db){return(await db.query('select pg_get_functiondef($1::regprocedure) definition',[reviewSignature])).rows[0].definition}
export async function verifyTrialReviewPlanning(h,{report=()=>{}}={}){
 const {db}=h
 await db.exec('reset role')
 const original=await reviewDefinition(db),preserved=await evidence(db)
 const metadata=async()=>(await db.query(`select oid,proowner,provolatile,prosecdef,proconfig,proacl,proparallel,proleakproof,proisstrict,procost,prorows,proargtypes,proargnames,prorettype,prokind,proretset from pg_proc where oid=$1::regprocedure`,[reviewSignature])).rows[0]
 const before=await metadata(),migration=await readFile(new URL(reviewPlanningMigration,root),'utf8')
 for(const sql of [
  'alter function '+reviewSignature+' rename to fixture_missing_review',
  original.replace('return (select exists','return (select not exists'),
  "create or replace function hq_private.trial_review_ready(p_trial_id uuid) returns boolean language sql stable security definer set search_path='' as $$select false$$",
  'alter function '+reviewSignature+' volatile',
  'alter function '+reviewSignature+' security invoker',
  'alter function '+reviewSignature+' strict',
  "alter function "+reviewSignature+" set search_path='public'",
 ]){
  await db.exec('begin')
  try{await db.exec(sql);await assert.rejects(db.exec(migration),/HQ_TRIAL_REVIEW_PLANNING_PREDECESSOR_MISMATCH/)}finally{await db.exec('rollback')}
 }
 await db.exec(migration)
 const candidate=await reviewDefinition(db),after=await metadata()
 assert.deepEqual(after,{...before,proconfig:[...before.proconfig,'join_collapse_limit=1']},'only reviewed function-local planner bound changes metadata')
 const proof=source=>source.slice(source.indexOf('return (select exists'))
 assert.equal(proof(candidate),proof(original),'entire authoritative proof remains byte-for-byte identical')
 const setting=(await db.query('show join_collapse_limit')).rows[0].join_collapse_limit
 const trial=(await db.query("select id,task_id,review_job_id from hq_private.workforce_trials where agent_id='AG-HR-003' and purpose='evaluator-skill-trial-v1' order by created_at desc,id desc limit 1")).rows[0]
 assert.ok(trial)
 const oracle=original.replace('FUNCTION hq_private.trial_review_ready(', 'FUNCTION hq_private.fixture_original_review(')
 await db.exec(oracle)
 await db.exec('revoke all on function hq_private.fixture_original_review(uuid) from public,anon,authenticated,service_role')
 const compare=async(expected)=>{
  const rows=(await db.query(`select t.id,hq_private.trial_review_ready(t.id) candidate,hq_private.fixture_original_review(t.id) original from hq_private.workforce_trials t order by t.id`)).rows
  for(const row of rows)assert.equal(row.candidate,row.original)
  if(expected!==undefined)assert.equal(rows.find(row=>row.id===trial.id).candidate,expected)
 }
 await compare(true)
 for(const id of [null,randomUUID()]){
  const row=(await db.query('select hq_private.trial_review_ready($1) candidate,hq_private.fixture_original_review($1) original',[id])).rows[0]
  assert.deepEqual(row,{candidate:false,original:false})
 }
 const mutations=[
  ['disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-003'"],
  ['tier',"update hq_private.agent_roster set model_tier='T2_HEAD' where id='AG-HR-003'"],
  ...['candidate','suspended','inactive','retired','terminated','archived','paused','testing-only','configured testing-only'].map(l=>['lifecycle '+l,`update hq_private.agent_roster set lifecycle='${l}' where id='AG-HR-003'`]),
  ['failed',`update hq_private.workforce_trials set status='failed' where id='${trial.id}'`],
  ['incomplete',`update hq_private.workforce_trials set completed_at=null where id='${trial.id}'`],
  ['late completion',`update hq_private.workforce_trials set completed_at=expires_at+interval '1 second' where id='${trial.id}'`],
  ['model drift',"update hq_private.agent_roster set model='synthetic-drift' where id='AG-HR-003'"],
  ['effort drift',"update hq_private.agent_roster set effort='low' where id='AG-HR-003'"],
  ['manager disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-001'"],
  ['reviewer disabled',"update hq_private.agent_roster set enabled=false where id='AG-CEO-001'"],
  ['source drift',"update hq_private.brain_files set source_version='2' where file_id='synthetic_repository_evaluator_skill'"],
  ['reviewer source missing version',"update hq_private.brain_files set source_version=null where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-CEO-001')"],
  ['reviewer source trashed',"update hq_private.brain_files set trashed=true,in_scope=false where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-CEO-001')"],
  ['reviewer source out of scope',"update hq_private.brain_files set in_scope=false where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-CEO-001')"],
  ['reviewer source invalid',"update hq_private.agent_roster set profile_file_id='missing-source' where id='AG-CEO-001'"],
  ['profile source version',"update hq_private.brain_files set source_version='2' where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-HR-003')"],
  ['empty skills',"update hq_private.agent_roster set skill_file_ids='[]' where id='AG-HR-003'"],
  ['duplicate skills',"update hq_private.agent_roster set skill_file_ids=skill_file_ids||skill_file_ids where id='AG-HR-003'"],
  ['missing skills',"update hq_private.agent_roster set skill_file_ids='[\"missing-source\"]' where id='AG-HR-003'"],
  ['department drift',"update hq_private.agent_roster set department_key='research-market-intelligence' where id='AG-HR-003'"],
  ['head rejection',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id=(select depends_on from public.hq_agent_jobs where id='${trial.review_job_id}')`],
  ['rejected review',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id='${trial.review_job_id}'`],
  ['missing task completion',`update public.hq_business_tasks set status='review' where id='${trial.task_id}'`],
 ]
 for(const [name,sql]of mutations){
  await db.exec('begin')
  try{await db.exec(sql);await compare(false)}catch(error){throw new Error(name+': '+error.message,{cause:error})}finally{await db.exec('rollback')}
 }
 for(const lifecycle of ['configured','trial','pending','active']){
  await db.exec('begin')
  try{await db.query("update hq_private.agent_roster set lifecycle=$1 where id='AG-HR-003'",[lifecycle]);await compare(true)}finally{await db.exec('rollback')}
 }
 // Exercise true ordinary proof too, not just the currently eligible evaluator.
 const ordinary=(await db.query("select id from hq_private.workforce_trials where agent_id='AG-DEV-002' and purpose='synthetic-internal-trial-v1' order by created_at desc,id desc limit 1")).rows[0]
 await db.exec('begin')
 try{
  await db.query("update hq_private.agent_roster set lifecycle='configured trial pending' where id='AG-DEV-002'")
  await compare(true)
  assert.equal((await db.query('select hq_private.trial_review_ready($1) ready',[ordinary.id])).rows[0].ready,true)
 }finally{await db.exec('rollback')}
 await db.exec('set join_collapse_limit=7')
 try{
  assert.equal((await db.query('select hq_private.trial_review_ready($1) ready',[trial.id])).rows[0].ready,true)
  assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7','true proof restores caller setting')
  assert.equal((await db.query('select hq_private.trial_review_ready(null) ready')).rows[0].ready,false)
  assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7','early false restores caller setting')
  await db.exec('begin')
  try{
   await db.query("update public.hq_agent_jobs set result_text='invalid-json' where id=$1",[trial.review_job_id])
   await db.exec(`do $$begin
    begin
     perform hq_private.trial_review_ready('${trial.id}'::uuid);
     raise exception 'Expected malformed proof rejection';
    exception when invalid_text_representation then
     if current_setting('join_collapse_limit')<>'7' then raise exception 'Planner setting leaked through error';end if;
    end;
   end$$`)
   assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7','error restores caller setting')
  }finally{await db.exec('rollback')}
 }finally{await db.query("select set_config('join_collapse_limit',$1,false)",[setting])}
 const status=async()=>{await h.as('founder');return h.rpc('hq_workforce_trial_status')}
 const samples={}
 for(const [name,definition]of [['baseline',original],['candidate',candidate]]){
  await db.exec('reset role');await db.exec(definition);samples[name]=[]
  for(let i=0;i<6;i++){const start=performance.now();const result=await status();samples[name].push(performance.now()-start);if(i===0)samples[name+'Result']=result}
 }
 assert.deepEqual(samples.candidateResult,samples.baselineResult,'complete status with exact ten-worker lifecycle mix')
 delete samples.candidateResult;delete samples.baselineResult
 await db.exec('reset role')
 // Count entries into the expensive proof, not just final booleans. This
 // instrumentation and sequence exist only inside a rolled-back fixture txn.
 await db.exec('begin')
 let counts
 try{
  await db.exec('create sequence hq_private.fixture_review_proof_entries')
  const count=async definition=>{
   await db.exec(definition.replace('return (select exists',"perform nextval('hq_private.fixture_review_proof_entries');\n return (select exists"))
   await db.exec('alter sequence hq_private.fixture_review_proof_entries restart with 1')
   const result=(await db.query(`select hq_private.trial_review_ready(trial_id) ready from (${latestOrdinary}) latest`)).rows
   assert.equal(result.filter(row=>row.ready).length,1)
   return Number((await db.query('select last_value from hq_private.fixture_review_proof_entries')).rows[0].last_value)
  }
  counts={baseline:await count(original),candidate:await count(candidate)}
  assert.deepEqual(counts,{baseline:10,candidate:1})
 }finally{await db.exec('rollback')}
 assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,setting,'local planner bound never leaks into caller')
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role)
  try{await assert.rejects(db.query('select hq_private.trial_review_ready(null)'),error=>error.code==='42501')}finally{await db.exec('reset role')}
 }
 assert.deepEqual(await evidence(db),preserved,'immutable evidence unchanged')
 report({fixture:{workers:10,ineligiblePassedOrdinary:8,canceled:1,eligibleEvaluator:1},proofEntries:counts,observationsOnly:true,...samples,mutations:mutations.length})
 return{original,candidate,trial,counts}
}
