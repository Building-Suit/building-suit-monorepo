/** Real generated synthetic repository evidence; never uses a hosted database. */
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {performance} from 'node:perf_hooks'
import {root,worker,historicalWorkerDigest,compatibleWorkerDigest,compatibilityMigration,repositoryWork,repositoryItem,delivery,entryFor,output,finishReviews,freeze} from './public-repository-db-fixture.mjs'
import {trialReviewFixture,reviewPlanningMigration} from './trial-review-planning-checks.mjs'
import {evidence} from './claim-query-budget-checks.mjs'
export const repositoryReviewPlanningMigration='20261110165424_hq_repository_review_planning.sql'
export const repositoryReviewSignature='hq_private.repository_review_ready(uuid)'
export const passedRepositoryAgent='AG-DEV-002'
export const repositoryBindingSource='synthetic_developer_profile_0'
export const latestRepository=`select a.id as agent_id,t.id as trial_id,t.status,t.completed_at<=t.expires_at as in_time
 from hq_private.agent_roster a left join lateral (
  select id,status,completed_at,expires_at from hq_private.workforce_trials where agent_id=a.id
   and purpose='public-repository-read-trial-v1' order by created_at desc,id desc limit 1
 )t on true where a.id in('AG-DEV-002','AG-DEV-003','AG-DEV-004') and a.enabled and a.model_tier='T1_WORKER' order by a.id`
export async function repositoryReviewFixture(f,{invoke}={}){
 const {h}=f
 await trialReviewFixture(f);await h.db.exec('reset role')
 await h.db.exec(await readFile(new URL(reviewPlanningMigration,root),'utf8'))
 await h.db.exec(await readFile(compatibilityMigration,'utf8'))
 const {trial,j}=await repositoryWork(f,passedRepositoryAgent),wire=repositoryItem(j)
 const entry=entryFor(j,await output(j,{repository:true,events:[wire.event],...(invoke?{invoke}:{})}))
 await h.db.exec('reset role;begin')
 try{
  for(const mutate of [
   x=>x.modelBindingEvidence.workerSourceDigest='0'.repeat(64),
   x=>delete x.modelBindingEvidence.workerSourceDigest,
   x=>x.modelBindingEvidence.workerSourceDigest=null,
   x=>x.modelBindingEvidence.publicRepositoryPolicy.moduleSha256='0'.repeat(64),
  ]){
   const bad=structuredClone(entry);mutate(bad);await h.db.exec('savepoint invalid_repository_proof')
   try{await h.as('worker');await assert.rejects(h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,bad.reply,null,JSON.stringify(bad.evidence),JSON.stringify(bad.modelExecutionEvidence),JSON.stringify(bad.modelBindingEvidence)]),/HQ_REPOSITORY_HOST_INVALID/)}
   finally{await h.db.exec('rollback to savepoint invalid_repository_proof;reset role')}
  }
 }finally{await h.db.exec('rollback')}
 await delivery(h,entry)
 await finishReviews(h,f.claim);await h.as('founder')
 assert.equal((await h.rpc('hq_issue_repository_qualification',[trial.trialId])).accepted,true)
 const bundle=await freeze(h,'AG-DEV-004','hq-ci-config-v1')
 await h.as('founder');const canceled=await h.rpc('hq_begin_repository_trial',['AG-DEV-004',bundle.bundleId,randomUUID()])
 await h.rpc('hq_cancel_task',[canceled.taskId]);await h.db.exec('reset role')
 // The historical fixture cancellation RPC does not label trials yet. Set the
 // observed canceled state only in this disposable, after actual task cancellation.
 await h.db.query("update hq_private.workforce_trials set status='canceled',completed_at=null where id=$1",[canceled.trialId])
 const latest=(await h.db.query(latestRepository)).rows
 assert.equal(latest.length,3)
 assert.equal(latest.filter(row=>row.status==='passed'&&row.in_time).length,1)
 assert.equal(latest.filter(row=>row.status==='canceled').length,1)
 assert.equal(latest.filter(row=>row.trial_id===null).length,1)
 return latest
}
export async function repositoryReviewEvidence(db){
 const result={ordinary:await evidence(db)}
 for(const table of ['repository_bundles','repository_reservations','repository_receipts','repository_host_executions','repository_qualifications'])result[table]=(await db.query(`select to_jsonb(x) data from hq_private.${table} x order by to_jsonb(x)::text`)).rows
 return result
}
export async function repositoryReviewDefinition(db){return(await db.query('select pg_get_functiondef($1::regprocedure) definition',[repositoryReviewSignature])).rows[0].definition}
export async function verifyRepositoryReviewPlanning(h,{report=()=>{}}={}){
 const {db}=h;await db.exec('reset role')
 const original=await repositoryReviewDefinition(db),preserved=await repositoryReviewEvidence(db)
 const originalSource=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[repositoryReviewSignature])).rows[0].prosrc
 assert.equal(createHash('md5').update(originalSource).digest('hex'),'328a9a163dcaa3880b8e4679969599c8')
 assert.ok(originalSource.includes("hq_private.repository_worker_digest_allowed(execution.proof->>'workerSourceDigest')"))
 const metadata=async()=>(await db.query(`select oid,prolang,proowner,provolatile,prosecdef,proconfig,proacl,proparallel,proleakproof,proisstrict,procost,prorows,proargtypes,proargnames,prorettype,prokind,proretset from pg_proc where oid=$1::regprocedure`,[repositoryReviewSignature])).rows[0]
 const before=await metadata(),migration=await readFile(new URL(repositoryReviewPlanningMigration,root),'utf8')
 for(const sql of [
  'alter function '+repositoryReviewSignature+' rename to fixture_missing_repository_review',
  original.replace('select exists','select not exists'),
  "create or replace function hq_private.repository_review_ready(p_trial uuid) returns boolean language plpgsql stable security definer set search_path='' as $$begin return false;end$$",
  'alter function '+repositoryReviewSignature+' volatile',
  'alter function '+repositoryReviewSignature+' security invoker',
  'alter function '+repositoryReviewSignature+' strict',
  "alter function "+repositoryReviewSignature+" set search_path='public'",
 ]){
  await db.exec('begin');try{await db.exec(sql);await assert.rejects(db.exec(migration),/HQ_REPOSITORY_REVIEW_PLANNING_PREDECESSOR_MISMATCH/)}finally{await db.exec('rollback')}
 }
 await db.exec(migration)
 const candidate=await repositoryReviewDefinition(db),after=await metadata()
 const language=(await db.query("select oid from pg_language where lanname='plpgsql'")).rows[0].oid
 assert.deepEqual(after,{...before,prolang:language,proconfig:[...before.proconfig,'join_collapse_limit=1']},'only language and scoped planner setting change')
 const candidateSource=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[repositoryReviewSignature])).rows[0].prosrc
 assert.equal(candidateSource.split(' return (')[1]?.split(');\nend')[0],originalSource,'complete current transformed proof bytes remain unchanged')
 const setting=(await db.query('show join_collapse_limit')).rows[0].join_collapse_limit
 const trial=(await db.query("select id,task_id,review_job_id,artifact_id from hq_private.workforce_trials where agent_id=$1 and purpose='public-repository-read-trial-v1' and status='passed' order by created_at desc,id desc limit 1",[passedRepositoryAgent])).rows[0]
 assert.ok(trial)
 await db.exec(original.replace('FUNCTION hq_private.repository_review_ready(', 'FUNCTION hq_private.fixture_original_repository_review('))
 await db.exec('revoke all on function hq_private.fixture_original_repository_review(uuid) from public,anon,authenticated,service_role')
 const inputs=(await db.query(latestRepository)).rows.map(row=>row.trial_id)
 const compare=async(expected)=>{
  const rows=(await db.query(`select trial_id,hq_private.repository_review_ready(trial_id) candidate,hq_private.fixture_original_repository_review(trial_id) original from unnest($1::uuid[]) trial_id`,[inputs])).rows
  for(const row of rows)assert.equal(row.candidate,row.original)
  if(expected!==undefined)assert.equal(rows.find(row=>row.trial_id===trial.id).candidate,expected)
 }
 await compare(true)
 for(const digest of [historicalWorkerDigest,compatibleWorkerDigest,null,'','0'.repeat(64)])assert.equal((await db.query('select hq_private.repository_worker_digest_allowed($1) allowed',[digest])).rows[0].allowed,[historicalWorkerDigest,compatibleWorkerDigest].includes(digest))
 const proofDigest=(await db.query("select proof->>'workerSourceDigest' digest from hq_private.repository_host_executions where artifact_id=$1",[trial.artifact_id])).rows[0].digest
 assert.ok([historicalWorkerDigest,compatibleWorkerDigest].includes(proofDigest))
 await db.exec('begin')
 try{await assert.rejects(db.query("update hq_private.repository_host_executions set proof=jsonb_set(proof,'{workerSourceDigest}',to_jsonb(repeat('0',64))) where artifact_id=$1",[trial.artifact_id]),/HQ_IMMUTABLE_RECORD/)}finally{await db.exec('rollback')}

 for(const id of [null,randomUUID()])assert.deepEqual((await db.query('select hq_private.repository_review_ready($1) candidate,hq_private.fixture_original_repository_review($1) original',[id])).rows[0],{candidate:false,original:false})
 const mutations=[
  ['disabled',"update hq_private.agent_roster set enabled=false where id='AG-DEV-002'"],
  ['tier',"update hq_private.agent_roster set model_tier='T2_HEAD' where id='AG-DEV-002'"],
  ...['configured','candidate','trial','pending','suspended','inactive','retired','terminated','archived','paused','testing-only'].map(l=>['lifecycle '+l,`update hq_private.agent_roster set lifecycle='${l}' where id='AG-DEV-002'`]),
  ['failed',`update hq_private.workforce_trials set status='failed' where id='${trial.id}'`],
  ['incomplete',`update hq_private.workforce_trials set completed_at=null where id='${trial.id}'`],
  ['late completion',`update hq_private.workforce_trials set completed_at=expires_at+interval '1 second' where id='${trial.id}'`],
  ['model drift',"update hq_private.agent_roster set model='synthetic-drift' where id='AG-DEV-002'"],
  ['effort drift',"update hq_private.agent_roster set effort='low' where id='AG-DEV-002'"],
  ['department drift',"update hq_private.agent_roster set department_key='research-market-intelligence' where id='AG-DEV-002'"],
  ['manager disabled',"update hq_private.agent_roster set enabled=false where id='AG-DEV-001'"],
  ['reviewer disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-003'"],
  ['reviewer source missing version',"update hq_private.brain_files set source_version=null where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-HR-003')"],
  ['reviewer source trashed',"update hq_private.brain_files set trashed=true,in_scope=false where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-HR-003')"],
  ['reviewer source out of scope',"update hq_private.brain_files set in_scope=false where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-HR-003')"],
  ['profile version',`update hq_private.brain_files set source_version='2' where file_id='${repositoryBindingSource}'`],
  ['skill version',"update hq_private.brain_files set source_version='2' where file_id='synthetic_repository_source_skill'"],
  ['skill missing version',"update hq_private.brain_files set source_version=null where file_id='synthetic_repository_source_skill'"],
  ['skill trashed',"update hq_private.brain_files set trashed=true,in_scope=false where file_id='synthetic_repository_source_skill'"],
  ['empty skills',"update hq_private.agent_roster set skill_file_ids='[]' where id='AG-DEV-002'"],
  ['duplicate skills',"update hq_private.agent_roster set skill_file_ids=skill_file_ids||skill_file_ids where id='AG-DEV-002'"],
  ['missing skills',`update hq_private.agent_roster set skill_file_ids='["missing-source"]' where id='AG-DEV-002'`],
  ['rejected review',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id='${trial.review_job_id}'`],
  ['head rejection',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id=(select depends_on from public.hq_agent_jobs where id='${trial.review_job_id}')`],
  ['task incomplete',`update public.hq_business_tasks set status='review' where id='${trial.task_id}'`],
 ]
 for(const [name,sql]of mutations){await db.exec('begin');try{await db.exec(sql);await compare(false)}catch(error){throw new Error(name+': '+error.message,{cause:error})}finally{await db.exec('rollback')}}
 // Validate nested proof, false shortcut and exception unwinding restore caller config.
 await db.exec('set join_collapse_limit=7')
 try{
  assert.equal((await db.query('select hq_private.repository_review_ready($1) ready',[trial.id])).rows[0].ready,true)
  assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7')
  assert.equal((await db.query('select hq_private.repository_review_ready(null) ready')).rows[0].ready,false)
  assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7')
  await db.exec('begin')
  try{
   await db.query("update public.hq_agent_jobs set result_text='invalid-json' where id=$1",[trial.review_job_id])
   await db.exec(`do $$begin begin
    perform hq_private.repository_review_ready('${trial.id}'::uuid);raise exception 'Expected invalid proof failure';
    exception when invalid_text_representation then if current_setting('join_collapse_limit')<>'7' then raise exception 'Planner setting leaked';end if;
   end;end$$`)
   assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,'7')
  }finally{await db.exec('rollback')}
 }finally{await db.query("select set_config('join_collapse_limit',$1,false)",[setting])}
 const samples={},status=async()=>{await h.as('founder');return h.rpc('hq_workforce_trial_status')}
 for(const [name,definition]of [['baseline',original],['candidate',candidate]]){
  await db.exec('reset role');await db.exec(definition);samples[name]=[]
  for(let i=0;i<6;i++){const start=performance.now();const result=await status();samples[name].push(performance.now()-start);if(i===0)samples[name+'Result']=result}
 }
 assert.deepEqual(samples.candidateResult,samples.baselineResult,'full JSON remains identical with actual repository proof')
 assert.equal(samples.candidateResult.find(row=>row.agentId===passedRepositoryAgent).repository.qualified,true)
 delete samples.baselineResult;delete samples.candidateResult;await db.exec('reset role')
 await db.exec('begin');let counts
 try{
  await db.exec('create sequence hq_private.fixture_repository_proof_entries')
  // Wrap the SQL predecessor only in this rollback-only fixture so its proof
  // entry can be counted. The normal timing/parity oracle remains exact SQL.
  const instrumentOriginal=original.replace('LANGUAGE sql','LANGUAGE plpgsql').replace(originalSource,`\nbegin\nperform nextval('hq_private.fixture_repository_proof_entries');\nreturn (${originalSource});\nend\n`)
  const instrumentCandidate=candidate.replace(' return ('," perform nextval('hq_private.fixture_repository_proof_entries');\n return (")
  const count=async definition=>{await db.exec(definition);await db.exec('alter sequence hq_private.fixture_repository_proof_entries restart with 1');const rows=(await db.query(`select hq_private.repository_review_ready(trial_id) ready from (${latestRepository}) latest`)).rows;assert.equal(rows.filter(row=>row.ready).length,1);return Number((await db.query('select last_value from hq_private.fixture_repository_proof_entries')).rows[0].last_value)}
  counts={baseline:await count(instrumentOriginal),candidate:await count(instrumentCandidate)};assert.deepEqual(counts,{baseline:3,candidate:1})
 }finally{await db.exec('rollback')}
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.query('select hq_private.repository_review_ready(null)'),error=>error.code==='42501')}finally{await db.exec('reset role')}}
 assert.equal((await db.query('show join_collapse_limit')).rows[0].join_collapse_limit,setting)
 assert.deepEqual(await repositoryReviewEvidence(db),preserved)
 report({fixture:{workers:10,repositoryPassed:1,repositoryCanceled:1,repositoryMissing:1},proofEntries:counts,mutations:mutations.length,proofDigest,observationsOnly:true,...samples})
 return{original,candidate,trial,counts}
}
