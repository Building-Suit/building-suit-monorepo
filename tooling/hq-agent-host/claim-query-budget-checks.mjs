/** Shared disposable assertions. No external endpoint, result cache, or timing threshold. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { root, freeze } from './public-repository-db-fixture.mjs'
export const migration='20261110002441_hq_skill_evidence_plan_reuse.sql'
export const agent='AG-DEV-004', skill='synthetic_repository_ci_skill'
export const predicate='select hq_private.workforce_skill_evidence_valid($1,$2) value'
export async function evidence(db) {
 return (await db.query(`select
 (select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.hq_task_artifacts a) artifacts,
 (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from hq_private.workforce_trial_host_execution_receipts r) host,
 (select md5(jsonb_agg(to_jsonb(q) order by receipt_id)::text) from hq_private.workforce_qualification_receipts q) qualifications`)).rows[0]
}
export async function verify(h) {
 const {db}=h
 await db.exec('reset role')
 const beforeEvidence=await evidence(db)
 const metadata=async()=>(await db.query(`select oid,proowner,provolatile,prosecdef,proconfig,proacl,
 proparallel,proleakproof,proisstrict,procost,prorows,proargtypes,proargnames,prorettype,prokind,proretset
 from pg_proc where oid='hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure`)).rows[0]
 const before=await metadata()
 const original=(await db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure")).rows[0]
 assert.equal(createHash('md5').update(original.prosrc).digest('hex'),'330fc6bb9768fd162e7537dbac2e8a1b')
 await h.as('founder');const status=await h.rpc('hq_workforce_trial_status')
 await db.exec('reset role')
 await db.exec(original.definition.replace('FUNCTION hq_private.workforce_skill_evidence_valid(', 'FUNCTION hq_private.workforce_skill_evidence_valid_original('))
 const migrationSql=await readFile(new URL(migration,root),'utf8')
 // An unexpected missing/changed predecessor must not create a PUBLIC-executable
 // helper or overwrite an unreviewed predicate. Roll back each disposable probe.
 for(const mutation of [
  'alter function hq_private.workforce_skill_evidence_valid(text,text) rename to workforce_skill_evidence_missing_fixture',
  original.definition.replace(original.prosrc,' select false '),
 ]){
  await db.exec('begin')
  try{await db.exec(mutation);await assert.rejects(db.exec(migrationSql),/HQ_SKILL_EVIDENCE_PLAN_PREDECESSOR_MISMATCH/)}
  finally{await db.exec('rollback')}
 }
 await db.exec(migrationSql)
 assert.deepEqual(await metadata(),before,'identity, owner, ACL and execution contract')
 const candidate=(await db.query("select p.prosrc,l.lanname from pg_proc p join pg_language l on l.oid=p.prolang where p.oid='hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure")).rows[0]
 assert.equal(candidate.lanname,'plpgsql')
 assert.equal(candidate.prosrc.trim(),'begin\n return ('+original.prosrc.trim().replace(/;$/,'')+');\nend','exact same SELECT including MATERIALIZED binding')
 await h.as('founder');assert.deepEqual(await h.rpc('hq_workforce_trial_status'),status,'whole status parity')
 await db.exec('reset role')
 const compare=async(a,s,expected)=>{
  const row=(await db.query(`select hq_private.workforce_skill_evidence_valid($1,$2) candidate,
   hq_private.workforce_skill_evidence_valid_original($1,$2) original`,[a,s])).rows[0]
  assert.equal(row.candidate,row.original);assert.equal(row.candidate,expected)
 }
 const pairs=(await db.query('select a.id,s.value from hq_private.agent_roster a cross join lateral jsonb_array_elements_text(a.skill_file_ids) s(value)')).rows
 assert.equal(pairs.length,5)
 for(const {id,value}of pairs)await compare(id,value,true)
 for(const pair of [[null,null],[agent,null],[null,skill],['missing',skill],[agent,'missing']])await compare(...pair,false)
 const mutations=[
  ['disabled',`update hq_private.agent_roster set enabled=false where id='${agent}'`],
  ['model',`update hq_private.agent_roster set model='changed-test-model' where id='${agent}'`],
  ['effort',`update hq_private.agent_roster set effort='low' where id='${agent}'`],
  ['department',`update hq_private.agent_roster set department_key='research-market-intelligence' where id='${agent}'`],
  ['tier',`update hq_private.agent_roster set model_tier='T2_HEAD' where id='${agent}'`],
  ['profile scope',"update hq_private.brain_files set trashed=true,in_scope=false where file_id='synthetic_developer_profile_2'"],
  ['profile version',"update hq_private.brain_files set source_version='2' where file_id='synthetic_developer_profile_2'"],
  ['skill version',`update hq_private.brain_files set source_version='2' where file_id='${skill}'`],
  ['failed trial',`update hq_private.workforce_trials set status='failed' where agent_id='${agent}' and status='passed'`],
  ['rejected review',`update public.hq_agent_jobs set result_text='{"accepted":false}' where id in(select review_job_id from hq_private.workforce_trials where agent_id='${agent}')`],
 ]
 for(const [name,sql]of mutations){
  await db.exec('begin')
  try{await db.exec(sql);await compare(agent,skill,false)}catch(error){throw new Error(name+': '+error.message,{cause:error})}
  finally{await db.exec('rollback')}
  await compare(agent,skill,true)
 }
 await db.exec('begin')
 try{await assert.rejects(db.query(`update hq_private.workforce_trial_host_execution_receipts set host_returned_model='changed-test-model'`),/HQ_IMMUTABLE_RECORD/)}finally{await db.exec('rollback')}
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role)
  try{await assert.rejects(db.query(predicate,[agent,skill]),error=>error.code==='42501')}
  finally{await db.exec('reset role')}
 }
 assert.deepEqual(await evidence(db),beforeEvidence,'artifact, host and qualification receipts unchanged')
 return {pairs:pairs.length,rejections:mutations.length,deniedRoles:3}
}

// Generate a real queued trial through the same founder and worker RPC path.
export async function prepareQueuedTrial(f) {
 const {h,claim}=f
 const bundle=(await freeze(h,agent,'hq-ci-config-v1')).bundleId
 await h.as('founder');await h.rpc('hq_begin_repository_trial',[agent,bundle,randomUUID()])
 let job=await claim();assert.equal(job.context.mode,'task-route')
 await h.finish(job,{assigneeId:'AG-DEV-001',reason:'Synthetic fixed scope.',message:'@Employee 9 supervise.'})
 job=await claim();assert.equal(job.context.mode,'task-ack')
 await h.finish(job,{message:'@Synthetic Developer 2 inspect only fixed synthetic scope.',delegateId:agent})
 job=await claim();assert.equal(job.context.mode,'trial-start')
 await h.finish(job,{message:'I acknowledge fixed synthetic scope.'})
 await h.db.exec('reset role')
}
export async function observeClaim(f) {
 await f.h.db.exec('reset role;begin')
 try {
  const job=await f.claim()
  assert.equal(job.context.mode,'worker-trial');assert.equal(job.agent_id,agent)
  return {id:job.id,agent:job.agent_id,mode:job.context.mode,model:job.context.model,effort:job.context.effort}
 } finally {await f.h.db.exec('rollback;reset role')}
}
