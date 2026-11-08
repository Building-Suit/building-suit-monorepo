/** Disposable PostgreSQL engine checks. No hosted writes or inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { maintenanceGate, checkApiContract, checkStaffingContract, REQUIRED_RPCS } from './maintenance.mjs'
import { workerExecutionBlock } from './departmentWorkflow.mjs'
import { validateStaffingProfileDraft } from './workforceRoster.mjs'
import { fake } from './test-cli.mjs'
import { checkApiContract as releasedContract } from './fixtures/maintenance-contract2-030f66ee.mjs'
import { deliverWorkerEntry, invokeCodex, codeOf, validateJob, validateTaskAckOutput, webAllowed, failedToolEvidence } from './worker.mjs'
const require = createRequire(new URL('../../apps/company-hq/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
const root = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
const proposals = root // Execute the canonical forward copies; parity also requires exact proposal bytes.
const founder = randomUUID(), workerUser = randomUUID(), worker = '3ead9a59-d84b-4e95-9871-abba0b129404', session = randomUUID(), workerSession = randomUUID()
const commonIds = ['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz','1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N']
const ids = ['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001']
const tiers = new Map(ids.map((id,index)=>[id,index===0?'T3_EXEC':[1,4,5,6,7,8,9].includes(index)?'T2_HEAD':'T1_WORKER']))
const departments = new Map(ids.map((id,index)=>[id,index===0?null:index===4?'research-market-intelligence':index===5?'customer-acquisition-partnerships':index===6?'customer-success-onboarding':index===7?'social-community':index===8?'email-lifecycle':index===9?'development-maintenance':'hr-agent-development']))
const managers = new Map(ids.map((id,index)=>[id,index===0?null:[2,3].includes(index)?'AG-HR-001':'AG-CEO-001']))
const roster = ids.map((id,index)=>({id,name:'Employee '+index,role:'Fixture',departmentKey:departments.get(id),profileFileId:'profile_source_'+index,skillFileIds:[],lifecycle:'configured trial pending',model:tiers.get(id)==='T1_WORKER'?'gpt-6.1-terra':tiers.get(id)==='T3_EXEC'?'gpt-6-astra':'gpt-6.1-sol',effort:'medium',managerId:managers.get(id),modelTier:tiers.get(id)}))
async function setup(withEvidence = true, withChat = false, withPresence = true, withLatest = false, withStatus = false, withTrialPacket = true) {
  const db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
    create table realtime.messages(topic text,event text,private boolean,payload jsonb,extension text default 'broadcast',inserted_at timestamptz default clock_timestamp());
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages(payload,event,topic,private) values($1,$2,$3,$4) $$;
    grant usage on schema public,auth,extensions,realtime to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`)
  for(const name of ['20261104194233_hq_founder_company_plans.sql','20261104231249_brain_drive_sync.sql']) await db.exec(await readFile(new URL(name,root),'utf8'))
  await db.exec(`create table hq_private.live_invalidations(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('brain','company','access')),created_at timestamptz default clock_timestamp(),delivered_at timestamptz);
    create function hq_private.live_deliver(uuid) returns boolean language sql as $$select true$$;`)
  for(const name of ['20261105035454_hq_agent_messages_worker_queue.sql','20261105150500_hq_workforce_tasks_learning.sql',...(withEvidence?['20261105155841_hq_native_tool_evidence.sql','20261105164140_hq_reviewer_learning_context.sql']:[])]) {
    try { await db.exec(await readFile(new URL(name,root),'utf8')) }
    catch(error) { throw new Error(name+': '+error.message,{cause:error}) }
  }
  if (withChat) await db.exec(await readFile(new URL('20261105180148_hq_conversational_chat.sql',root),'utf8'))
  if (withPresence) await db.exec(await readFile(new URL('20261105192548_hq_presence_without_snapshot_polling.sql',root),'utf8'))
  if (withLatest) for (const file of ['20261105201905_hq_chat_intake_size_recovery.sql','20261105204244_hq_hr_output_supervisor_recovery.sql']) await db.exec(await readFile(new URL(file,root),'utf8'))
  if (withPresence) await db.exec(await readFile(new URL('20261105235516_hq_voice_meetings.sql',root),'utf8'))
  if (withPresence) await db.exec(await readFile(new URL('./bootstrap/admission-pause.sql', import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('20261107024306_hq_department_staffing_needs.sql',proposals),'utf8'))
  await db.exec(await readFile(new URL('20261107024314_hq_department_orchestration_contract.sql',proposals),'utf8'))
  await db.exec(await readFile(new URL('20261107024322_hq_supervised_worker_trials.sql',proposals),'utf8'))
  await db.exec(await readFile(new URL('20261107024331_hq_qualified_research_web_search.sql',proposals),'utf8'))
  await db.exec(await readFile(new URL('20261107024338_hq_worker_model_execution_receipts.sql',proposals),'utf8'))
  await db.exec(await readFile(new URL('20261107024348_hq_worker_release_capability.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261107034418_hq_workforce_trial_delivery.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261107040848_hq_trial_failure_and_assigned_skills.sql',root),'utf8'))
  if(withTrialPacket)await db.exec(await readFile(new URL('20261107201336_hq_supervised_trial_context_packet.sql',root),'utf8'))
  if (withStatus) for (const file of ['20261105171608_hq_office_observations.sql','20261107133124_hq_worker_status_compatibility.sql']) await db.exec(await readFile(new URL(file,root),'utf8'))
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',clock_timestamp()),($2,'worker@example.invalid',clock_timestamp());`,[founder,workerUser])
  await db.query(`insert into auth.sessions(id,user_id) values($1,$2),($3,$4)`,[session,founder,workerSession,workerUser])
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:founder,role:'authenticated',session_id:session})])
  await db.query(`select hq_private.bind_founder()`)
  await db.query(`select hq_private.register_agent_worker($1,$2)`,[worker,workerUser])
  for(const id of [...commonIds,...roster.map(x=>x.profileFileId)]) await db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,trashed,in_scope) values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','fixture.md','text/markdown',false,true)`,[id])
  async function as(who) {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify(who==='worker'?{sub:workerUser,role:'authenticated',session_id:workerSession}:{sub:founder,role:'authenticated',session_id:session})])
    await db.exec('set role authenticated')
  }
  async function rpc(name,args=[]) { const r=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);return r.rows[0].result }
  await as('worker'); await rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster)])
  return {db,as,rpc,async claim(){await as('worker');return(await rpc('hq_worker_claim',[worker,300])).job},async finish(j,reply,error=null,evidence=[]){await as('worker');return rpc(withEvidence?'hq_worker_finish_v2':'hq_worker_finish',[j.id,j.lease_token,worker,typeof reply==='string'?reply:JSON.stringify(reply),error,...(withEvidence?[JSON.stringify(evidence)]:[])])}}
}

test('founder task → actual employee artifact → reviews → report → accepted learning; guards and cancellation',async()=>{
  const h=await setup(); const {db,as,rpc}=h
  try {
    await assert.rejects(()=>rpc('hq_create_task',['Unauthorized','brief','acceptance','AG-HR-002',randomUUID()]),/HQ_FOUNDER_REQUIRED/)
    await as('founder'); await assert.rejects(()=>rpc('hq_worker_claim',[worker,300]),/HQ_WORKER_REQUIRED/)
    await assert.rejects(()=>db.query('select * from public.hq_business_tasks'),/permission denied/)
    const key=randomUUID(),args=['Research brief','Produce a useful draft','Cite evidence and state limits','AG-HR-002',key]
    const snapshot=await rpc('hq_create_task',args)
    assert.equal(snapshot.version,2);assert.equal(snapshot.agents.length,10);assert.equal(snapshot.tasks.length,1)
    const task=snapshot.tasks[0];assert.equal(task.assigneeId,'AG-HR-002')
    assert.equal((await rpc('hq_create_task',args)).tasks[0].id,task.id)
    await assert.rejects(()=>rpc('hq_create_task',['Changed',...args.slice(1)]),/HQ_REQUEST_KEY_REUSED/)
    let j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.agent_id,'AG-HR-002');assert.equal(j.context.agent.model,'gpt-6.1-terra')
    await h.finish(j,'Actual draft with source evidence.');await h.finish(j,'Actual draft with source evidence.')
    await assert.rejects(()=>h.finish(j,'Changed draft'),/HQ_RESULT_ALREADY_COMMITTED/)
    j=await h.claim();assert.equal(j.context.mode,'head-review');assert.equal(j.agent_id,'AG-HR-001');assert.equal(j.context.assignee.id,'AG-HR-002');assert.ok(j.context.brain_files.some(file=>file.id==='profile_source_2'))
    await h.finish(j,{accepted:true,summary:'Head checked source evidence.',artifactDigest:j.context.artifact.digest})
    j=await h.claim();assert.equal(j.context.mode,'ceo-review');assert.equal(j.agent_id,'AG-CEO-001')
    await h.finish(j,{accepted:true,summary:'Founder acceptance met.',artifactDigest:j.context.artifact.digest})
    j=await h.claim();assert.equal(j.context.mode,'task-report');await h.finish(j,'Delivered the reviewed draft; no external execution.')
    j=await h.claim();assert.equal(j.context.mode,'lesson-extract');await h.finish(j,{summary:'Evidence before claims',body:'Cite observed evidence and state unavailable external actions. Source: reviewed task.'})
    j=await h.claim();assert.equal(j.context.mode,'lesson-review');assert.ok(j.context.task_history.some(x=>x.kind==='task-work'));assert.ok(j.context.task_history.every(x=>typeof x.text==='string'&&typeof x.truncated==='boolean'));await h.finish(j,{accepted:true,summary:'Grounded in the completed source.'})
    const pending=await rpc('hq_worker_pending_lessons',[worker]);assert.equal(pending.length,1)
    const receipt=['https://drive.google.com/file/d/learning_output_file/view',pending[0].digest]
    await rpc('hq_worker_publish_lesson',[worker,pending[0].id,...receipt]);await rpc('hq_worker_publish_lesson',[worker,pending[0].id,...receipt])
    await assert.rejects(()=>rpc('hq_worker_publish_lesson',[worker,pending[0].id,receipt[0],'2'.repeat(64)]),/HQ_INVALID_LESSON_RECEIPT|HQ_LESSON_ALREADY_PUBLISHED/)
    await as('founder');const final=await rpc('hq_agent_snapshot');assert.equal(final.tasks[0].status,'completed');assert.equal(final.lessons[0].status,'published');assert.equal(final.messages.filter(x=>x.role==='assistant').length,1)
    const c=await rpc('hq_create_task',['Cancel','Do draft','Draft','AG-HR-002',randomUUID()]);const cancelId=c.tasks.find(x=>x.title==='Cancel').id
    j=await h.claim();await as('founder');await rpc('hq_cancel_task',[cancelId]);assert.equal((await h.finish(j,'Late result must not publish')).discarded,true)
    await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).rows[0].n,0)
  } finally {await db.close()}
})

test('model execution receipt is immutable, artifact-bound and records fallback model as Luna',async()=>{
 const h=await setup();const {db,as,rpc}=h
 try {
  await as('founder')
  const created=await rpc('hq_create_task',['Receipt test','Create one internal draft.','Return one draft and no external action.','AG-HR-002',randomUUID()])
  const job=await h.claim()
  const evidence={schemaVersion:1,workerJobId:job.id,workerId:worker,agentId:job.agent_id,
   policy:'terra-primary-luna-fallback-v1',configuredModel:'gpt-6.1-terra',selectedModel:'gpt-6-luna',
   providerServedModel:'unknown',fallbackUsed:true,outcome:'completed',attempts:[
    {model:'gpt-6.1-terra',outcome:'failed',errorCode:'provider-model-unavailable',toolEventCount:0,rerouteCount:0,turnsStarted:0,turnsCompleted:0},
    {model:'gpt-6-luna',outcome:'completed',errorCode:null,toolEventCount:0,rerouteCount:0,turnsStarted:1,turnsCompleted:1},
   ]}
  await as('worker')
  await rpc('hq_worker_finish_v3',[job.id,job.lease_token,worker,'Actual fallback draft.',null,'[]',JSON.stringify(evidence)])
  await db.exec('reset role')
  const stored=await db.query(`select r.configured_model,r.selected_model,r.provider_served_model,r.fallback_used,r.evidence
   from hq_private.workforce_model_execution_receipts r where r.job_id=$1`,[job.id])
  assert.deepEqual(stored.rows[0],{configured_model:'gpt-6.1-terra',selected_model:'gpt-6-luna',provider_served_model:'unknown',fallback_used:true,evidence})
  await assert.rejects(()=>db.query(`update hq_private.workforce_model_execution_receipts set selected_model='gpt-6.1-terra' where job_id=$1`,[job.id]),/HQ_IMMUTABLE_RECORD/)
  assert.equal(created.tasks[0].assigneeId,'AG-HR-002')
 } finally {await db.close()}
})

test('model receipt validation rejects null counters and models outside the current roster binding atomically',async()=>{
 for(const mode of ['null-counter','wrong-model']){
  const h=await setup();const {db,as,rpc}=h
  try{
   await as('founder')
   await rpc('hq_create_task',['Receipt gate '+mode,'Create one internal draft.','Return one draft and no external action.','AG-HR-002',randomUUID()])
   const job=await h.claim()
   const evidence={schemaVersion:1,workerJobId:job.id,workerId:worker,agentId:job.agent_id,
    policy:mode==='wrong-model'?'canonical-model-only-v1':'terra-primary-luna-fallback-v1',
    configuredModel:mode==='wrong-model'?'gpt-6-luna':'gpt-6.1-terra',selectedModel:mode==='wrong-model'?'gpt-6.1-terra':'gpt-6-luna',
    providerServedModel:'unknown',fallbackUsed:mode!=='wrong-model',outcome:'completed',attempts:mode==='wrong-model'?
     [{model:'gpt-6.1-terra',outcome:'completed',errorCode:null,toolEventCount:0,rerouteCount:0,turnsStarted:1,turnsCompleted:1}]:[
      {model:'gpt-6.1-terra',outcome:'failed',errorCode:'provider-model-unavailable',toolEventCount:0,rerouteCount:0,turnsStarted:1,turnsCompleted:1},
      {model:'gpt-6-luna',outcome:'completed',errorCode:null,toolEventCount:0,rerouteCount:0,turnsStarted:1,turnsCompleted:1},
     ]}
   if(mode==='null-counter') evidence.attempts[0].turnsStarted=null
   else {await db.exec('reset role');await db.query(`update hq_private.agent_roster set model='gpt-6-luna' where id=$1`,[job.agent_id])}
   await as('worker')
   const expected=mode==='null-counter'?/HQ_MODEL_EXECUTION_ATTEMPT_INVALID/:/HQ_MODEL_EXECUTION_PRIMARY_INVALID/
   await assert.rejects(()=>rpc('hq_worker_finish_v3',[job.id,job.lease_token,worker,'Draft.',null,'[]',JSON.stringify(evidence)]),expected)
   await db.exec('reset role')
   const state=await db.query(`select status,result_digest from public.hq_agent_jobs where id=$1`,[job.id])
   assert.deepEqual(state.rows[0],{status:'working',result_digest:null})
  }finally{await db.close()}
 }
})

test('staffing-required worker failure creates one durable HR-owned need and leaves the task blocked',async()=>{
  const h=await setup();const {db,as,rpc}=h
  try {
    await db.exec('reset role')
    await db.query(`update hq_private.agent_roster set department_key='social-community' where id='AG-SOC-001'`)
    await as('founder')
    const started=await rpc('hq_create_task',['Social draft','Prepare a bounded draft for the Social department.','Use the department brief and acceptance criteria.','AG-SOC-001',randomUUID()])
    const task=started.tasks[0];assert.equal(task.assigneeId,'AG-SOC-001')
    const job=await h.claim();assert.equal(job.agent_id,'AG-SOC-001');assert.equal(job.context.mode,'task-work')
    await h.finish(job,'','staffing-required')
    await h.finish(job,'','staffing-required')
    await as('founder')
    const snapshot=await rpc('hq_agent_snapshot')
    assert.equal(snapshot.tasks.find(row=>row.id===task.id).status,'blocked')
    assert.equal(snapshot.tasks.find(row=>row.id===task.id).error,'staffing-required')
    await db.exec('reset role')
    const needs=await db.query(`select department_key,department_head_id,hr_owner_id,reason_code,status,blocked_agent_id
      from hq_private.department_staffing_needs where task_id=$1`,[task.id])
    assert.deepEqual(needs.rows,[{department_key:'social-community',department_head_id:'AG-SOC-001',hr_owner_id:'AG-HR-001',reason_code:'no-eligible-worker',status:'open',blocked_agent_id:'AG-SOC-001'}])
    const agents=await db.query(`select count(*)::int count from hq_private.agent_roster`)
    assert.equal(agents.rows[0].count,10)
    assert.equal(snapshot.messages.filter(message=>message.kind==='task-result').length,0)
  } finally { await db.close() }
})

test('canonical additional worker sync remains dynamic and unqualified without real trial evidence',async()=>{
 const h=await setup(true,true);try{
  const profile='profile_rania_0001',skill='skill_social_0001'
  await h.db.exec('reset role')
  for(const id of [profile,skill]) await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope) values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','worker.md','text/markdown','1',false,true)`,[id])
  const rania={id:'AG-SOC-002',name:'Rania',role:'Social Worker',departmentKey:'social-community',profileFileId:profile,skillFileIds:[skill],lifecycle:'Active',model:'gpt-6.1-terra',effort:'medium',managerId:'AG-SOC-001',modelTier:'T1_WORKER'}
  await h.as('worker');const result=await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify([...roster,rania])]);assert.equal(result.count,11)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select model_tier from hq_private.agent_roster where id='AG-SOC-002'`)).rows[0].model_tier,'T1_WORKER')
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-SOC-002') ok`)).rows[0].ok,false)
  assert.equal((await h.db.query(`select hq_private.workforce_agent_assignable('AG-SOC-002') ok`)).rows[0].ok,true)
  assert.equal((await h.db.query(`select count(*)::int n from hq_private.workforce_qualification_receipts where agent_id='AG-SOC-002'`)).rows[0].n,0)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster)])
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select enabled from hq_private.agent_roster where id='AG-SOC-002'`)).rows[0].enabled,false)
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-SOC-002') ok`)).rows[0].ok,false)
 }finally{await h.db.close()}
})

test('supervised trial stays internal and requires same-thread host-returned settings plus head and Iris review',async()=>{
 const h=await setup(true,true);try{
  const skill='trial_skill_0001',requestKey=randomUUID()
  await h.db.exec('reset role')
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
    values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic skill.md','text/markdown','1',false,true)`,[skill])
  await h.db.query(`update hq_private.brain_files set source_version='1' where file_id='profile_source_2'`)
  const initial=roster.map(x=>x.id==='AG-HR-002'?{...x,departmentKey:'research-market-intelligence',managerId:'AG-RES-001',lifecycle:'Configured; supervised trial pending',skillFileIds:[skill]}:x)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(initial)])
  await h.as('founder');const trial=await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,requestKey])
  assert.equal(trial.status,'active');assert.equal(trial.headId,'AG-RES-001')
  await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  let firstTrialWorkerJobId
  let job=await h.claim();assert.equal(job.context.mode,'task-route')
  await h.finish(job,{assigneeId:'AG-RES-001',reason:'The authorized Research head will scope the synthetic trial.',message:'@Employee 4 will supervise the internal skill trial.'})
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select hq_private.workforce_trial_context($1,'AG-HR-002') is not null ok`,[trial.taskId])).rows[0].ok,true)
  assert.equal((await h.db.query(`select manager_id,model_tier from hq_private.agent_roster where id='AG-HR-002'`)).rows[0].manager_id,'AG-RES-001')
  job=await h.claim();assert.equal(job.context.mode,'task-ack');assert.deepEqual(job.context.roster.map(x=>x.id),['AG-HR-002'])
  assert.equal(job.context.roster[0].supervisedTrial.status,'active')
  await h.finish(job,{message:'@Employee 2 complete only the synthetic internal exercise against these checks.',delegateId:'AG-HR-002'})
  job=await h.claim();assert.ok(job,'the delegated trial worker receives the task-start job')
  assert.equal(job.context.mode,'trial-start');assert.equal(workerExecutionBlock(job),null)
  await h.finish(job,{message:'I understand the synthetic task and its no-external-action boundary.'})
  job=await h.claim();assert.equal(job.context.mode,'worker-trial');assert.equal(workerExecutionBlock(job),null);assert.equal(webAllowed(job),false)
  assert.deepEqual(job.context.agent.skillFileIds,[skill]);assert.ok(job.context.brain_files.every(f=>!f.id.startsWith('skill_unassigned')))
  firstTrialWorkerJobId=job.id
  await h.finish(job,'Synthetic internal artifact with assumptions marked and acceptance self-check.')
  job=await h.claim();assert.equal(job.context.mode,'head-review');assert.equal(job.agent_id,'AG-RES-001')
  await h.finish(job,{accepted:true,summary:'Research head verified the internal task scope and artifact.',artifactDigest:job.context.artifact.digest})
  job=await h.claim();assert.equal(job.context.mode,'ceo-review');assert.equal(job.agent_id,'AG-HR-003');assert.equal(job.context.trialReview,true)
  validateJob(job);assert.match((await import('./worker.mjs')).stageInstructions(job),/independently evaluate the exact supervised trial artifact/)
  await h.finish(job,{accepted:false,summary:'Add a concrete skill-specific check that is present in the supplied internal task.',artifactDigest:job.context.artifact.digest})
  job=await h.claim();assert.equal(job.context.mode,'task-ack');assert.equal(job.agent_id,'AG-RES-001');assert.deepEqual(job.context.roster.map(x=>x.id),['AG-HR-002'])
  await h.finish(job,{message:'@Employee 2 correct only Iris’s stated missing skill-specific check in the existing synthetic artifact.',delegateId:'AG-HR-002'})
  job=await h.claim();assert.ok(job,'the head-scoped correction returns to the exact trial worker')
  assert.equal(job.context.mode,'trial-start');assert.equal(job.agent_id,'AG-HR-002')
  await h.finish(job,{message:'I will add only the requested check.'})
  job=await h.claim();assert.equal(job.context.mode,'worker-trial');assert.equal(job.agent_id,'AG-HR-002')
  await h.finish(job,'Revised synthetic artifact with a concrete skill-specific check and bounded self-check.')
  job=await h.claim();assert.equal(job.context.mode,'head-review');assert.equal(job.agent_id,'AG-RES-001')
  await h.finish(job,{accepted:true,summary:'Research head verified the bounded correction and original checks.',artifactDigest:job.context.artifact.digest})
  job=await h.claim();assert.equal(job.context.mode,'ceo-review');assert.equal(job.agent_id,'AG-HR-003');assert.equal(job.context.trialReview,true)
  await h.finish(job,{accepted:true,summary:'Iris independently verified the corrected synthetic artifact and trial boundary.',artifactDigest:job.context.artifact.digest})
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select status from hq_private.workforce_trials where id=$1`,[trial.trialId])).rows[0].status,'passed')
  assert.equal((await h.db.query(`select count(*)::int n from hq_private.workforce_qualification_receipts where trial_id=$1`,[trial.trialId])).rows[0].n,0)
  await h.as('founder')
  await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  job=await h.claim();assert.equal(job.context.mode,'task-report');assert.equal(job.context.trialReport,true)
  await h.finish(job,'Internal supervised trial completed; qualification is not automatic.')
  assert.equal(await h.claim(),null)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-HR-002') ok`)).rows[0].ok,false)
  const linked=(await h.db.query(`select t.artifact_id,a.job_id,a.digest,j.worker_id from hq_private.workforce_trials t
    join public.hq_task_artifacts a on a.id=t.artifact_id join public.hq_agent_jobs j on j.id=a.job_id where t.id=$1`,[trial.trialId])).rows[0]
  const hostEvidence={schemaVersion:1,attestationLevel:'host-returned-resolution',providerServedModel:'unknown',agentId:'AG-HR-002',workerId:worker,
    workerJobId:linked.job_id,trialId:trial.trialId,taskId:trial.taskId,workerSourceDigest:'a'.repeat(64),nodeVersion:process.versions.node,cliVersion:'codex-cli 0.159.2',
    cliVersionSource:'same-binary-version-probe',cliExecutable:'/opt/codex/bin/codex',cliBinaryDigest:'b'.repeat(64),
    configuredModel:'gpt-6.1-terra',launchModel:'gpt-6.1-terra',configuredEffort:'medium',launchEffort:'medium',
    settingObservationSource:'explicit-codex-app-server-thread-start-and-locked-config',invocationStatus:'launched',threadId:randomUUID(),laterModelOverrideCount:0,turnsStarted:1,turnsCompleted:1,
    hostResolution:{source:'codex-app-server-thread-start',model:'gpt-6.1-terra',modelProvider:'openai',reasoningEffort:'medium',threadId:'',laterModelOverrideCount:0},
    invocation:{executable:'/opt/codex/bin/codex',argv:['app-server','--stdio','--strict-config','--disable','shell_tool','--disable','shell_snapshot',
        '-c','approval_policy="never"','-c','model_provider="openai"','-c','web_search="disabled"','-c','model_reasoning_effort="medium"','-c','mcp_servers={}'],
      environment:{HOME:'/home/worker',PATH:'/usr/bin',LANG:'C.UTF-8',TERM:'dumb',CODEX_HOME:'/home/worker/.codex'},stdinSha256:'c'.repeat(64),
      protocol:{initialize:{method:'initialize',id:1},threadStart:{method:'thread/start',id:2,params:{model:'gpt-6.1-terra',modelProvider:'openai',cwd:'/tmp/hq-agent-test',
        approvalPolicy:'never',sandbox:'read-only',ephemeral:true,developerInstructions:'',config:{model_reasoning_effort:'medium',web_search:'disabled',project_doc_max_bytes:0,
          developer_instructions:'',mcp_servers:{},agents:{enabled:false},skills:{bundled:{enabled:false},include_instructions:false}}}},
        turnStart:{method:'turn/start',id:3,params:{threadId:randomUUID(),inputSha256:'c'.repeat(64)}}}},
    observedErrors:[],observedReroutes:[],observedEventCoverage:'codex-app-server-jsonrpc-events-only',outcome:'completed',artifactDigest:linked.digest}
  hostEvidence.hostResolution.threadId=hostEvidence.threadId
  hostEvidence.invocation.protocol.turnStart.params.threadId=hostEvidence.threadId
  await h.as('founder')
  await assert.rejects(()=>h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(hostEvidence),'journal:'+linked.job_id]),/permission denied/)
  await h.db.exec('reset role')
  const earlier=(await h.db.query(`select a.id artifact_id,a.job_id,a.digest from public.hq_task_artifacts a where a.job_id=$1`,[firstTrialWorkerJobId])).rows[0]
  const launchOnlyEvidence={...hostEvidence,attestationLevel:'host-launch-settings',workerJobId:earlier.job_id,
    hostResolution:null,threadId:randomUUID(),artifactDigest:earlier.digest,
    invocation:{...hostEvidence.invocation,protocol:{...hostEvidence.invocation.protocol,
      turnStart:{...hostEvidence.invocation.protocol.turnStart,params:{...hostEvidence.invocation.protocol.turnStart.params}}}}}
  launchOnlyEvidence.invocation.protocol.turnStart.params.threadId=launchOnlyEvidence.threadId
  await h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,
    [trial.trialId,earlier.job_id,earlier.artifact_id,JSON.stringify(launchOnlyEvidence),'journal:'+earlier.job_id])
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  await h.db.exec('reset role')
  const falseProviderClaim={...hostEvidence,providerServedModel:'gpt-6.1-sol'}
  await assert.rejects(()=>h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(falseProviderClaim),'journal:'+linked.job_id]),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  const falseHostResolution={...hostEvidence,hostResolution:{...hostEvidence.hostResolution,model:'gpt-6-luna'}}
  await assert.rejects(()=>h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(falseHostResolution),'journal:'+linked.job_id]),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  const {rows:executionRows}=await h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5) id`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(hostEvidence),'journal:'+linked.job_id])
  const hostExecutionId=executionRows[0].id
  const executionReplay=await h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5) id`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(hostEvidence),'journal:'+linked.job_id])
  assert.equal(executionReplay.rows[0].id,hostExecutionId)
  await assert.rejects(()=>h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,[trial.trialId,linked.job_id,linked.artifact_id,JSON.stringify(hostEvidence),'journal:other-job-reference']),/HQ_TRIAL_HOST_EXECUTION_CONFLICT/)
  await assert.rejects(()=>h.db.query(`select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)`,[randomUUID(),linked.job_id,linked.artifact_id,JSON.stringify(hostEvidence),'journal:'+linked.job_id]),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  await assert.rejects(()=>h.db.exec(`update hq_private.workforce_trial_host_execution_receipts set cli_version='codex-cli 0.0.0'`),/HQ_IMMUTABLE/)
  await h.as('founder');const receipt=await h.rpc('hq_issue_workforce_qualification',[trial.trialId])
  assert.equal(receipt.accepted,true);assert.equal(receipt.reviewerId,'AG-HR-003')
  const replay=await h.rpc('hq_issue_workforce_qualification',[trial.trialId]);assert.equal(replay.receiptId,receipt.receiptId)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select host_execution_id from hq_private.workforce_qualification_receipts where trial_id=$1`,[trial.trialId])).rows[0].host_execution_id,hostExecutionId)
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-HR-002') ok`)).rows[0].ok,false)
  const active=initial.map(x=>x.id==='AG-HR-002'?{...x,lifecycle:'Active'}:x)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(active)])
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-HR-002') ok`)).rows[0].ok,true)
  const qualificationContext=(await h.db.query(`select hq_private.workforce_qualification_context('AG-HR-002') context`)).rows[0].context
  assert.equal(qualificationContext.hostExecutionId,hostExecutionId)
  assert.equal(qualificationContext.providerServedModel,'unknown')
  assert.equal(Object.hasOwn(qualificationContext,'resolvedModel'),false)
  assert.equal((await h.db.query(`select hq_private.worker_native_web_authorized('AG-HR-002','task-work') ok`)).rows[0].ok,true)
  await h.as('founder')
  const taskSnapshot=await h.rpc('hq_create_task',['Synthetic Research Tool Binding','Use only the assigned skill for a bounded public-source research draft.','Use primary sources; do not contact anyone.','AG-RES-001',randomUUID()])
  const researchTask=taskSnapshot.tasks.find(t=>t.title==='Synthetic Research Tool Binding')
  job=await h.claim();assert.equal(job.context.mode,'task-route')
  await h.finish(job,{assigneeId:'AG-RES-001',reason:'The Research head owns the bounded sourcing plan.',message:'@Employee 4 will scope and delegate the read-only research.'})
  job=await h.claim();assert.equal(job.context.mode,'task-ack');assert.equal(job.agent_id,'AG-RES-001')
  assert.deepEqual(job.context.roster.map(x=>x.id),['AG-HR-002'])
  await h.finish(job,{delegateId:'AG-HR-002',message:'@Employee 2 prepare the requested source-backed draft only.'})
  job=await h.claim();assert.equal(job.context.mode,'task-start');assert.equal(job.agent_id,'AG-HR-002');assert.equal(workerExecutionBlock(job),null)
  await h.finish(job,{message:'I understand the read-only research brief and its limits.'})
  job=await h.claim();assert.equal(job.context.mode,'task-work');assert.equal(job.context.task.id,researchTask.id);assert.equal(webAllowed(job),true)
  const nativeEvidence=[{version:1,eventId:'research_web_1',tool:'web_search',action:'open_page',queries:['public product fit evidence'],sources:[{url:'https://example.com/public-primary',title:'Primary source',excerpt:'Synthetic fixture excerpt only.'}],observedAt:new Date().toISOString(),truncated:false}]
  await h.finish(job,'Synthetic internal research artifact with one cited public source.',null,nativeEvidence)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select count(*)::int n from hq_private.native_tool_receipts r join public.hq_task_artifacts a on a.id=r.artifact_id where a.task_id=$1`,[researchTask.id])).rows[0].n,1)
  // Capability is evaluated from the live qualified roster on each task; the
  // office telemetry RPC belongs to a different production migration fixture.
  await h.db.query(`update hq_private.agent_roster set skill_file_ids='[]' where id='AG-HR-002'`)
  assert.equal((await h.db.query(`select hq_private.workforce_agent_qualified('AG-HR-002') ok`)).rows[0].ok,false)
 }finally{await h.db.close()}
})

test('two repair rounds only; digest mismatch and expired leases never become accepted artifacts',async()=>{
 const h=await setup();try{
  await h.as('founder');await h.rpc('hq_create_task',['Repair','Write draft','Verified accuracy','AG-RES-001',randomUUID()])
  for(let attempt=0;attempt<3;attempt++){
   let j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.context.task.attempt,attempt);await h.finish(j,'Draft attempt '+attempt)
   j=await h.claim();assert.equal(j.context.mode,'ceo-review');await h.finish(j,{accepted:false,summary:'Repair missing source evidence.',artifactDigest:j.context.artifact.digest})
  }
  let lessonJob=await h.claim();assert.equal(lessonJob.context.mode,'lesson-extract');assert.equal(lessonJob.context.task.status,'blocked');assert.ok(lessonJob.context.task_history.some(x=>x.kind==='ceo-review'));
  await h.finish(lessonJob,{summary:'Review failure lesson',body:'Failed drafts need observed supporting evidence.'});lessonJob=await h.claim();assert.equal(lessonJob.context.mode,'lesson-review');assert.ok(lessonJob.context.task_history.some(x=>x.kind==='task-work'));await h.finish(lessonJob,{accepted:false,summary:'This proposed lesson needs more specific source support.'});
  assert.equal(await h.claim(),null);await h.as('founder');let s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].repairCount,2);assert.equal(s.tasks[0].error,'review-repairs-exhausted')
  await h.rpc('hq_create_task',['Expiry','Draft','Proof','AG-RES-001',randomUUID()]);const j=await h.claim()
  await h.db.exec('reset role');await h.db.query(`update public.hq_agent_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1`,[j.id])
  assert.equal((await h.finish(j,'Uncertain late reply')).discarded,true);assert.equal(await h.claim(),null)
 }finally{await h.db.close()}
})

test('legacy chat remains two real jobs, learning is source-linked, and later jobs retrieve accepted lessons',async()=>{
 const h=await setup();try{
  await h.as('worker');const sources=await h.rpc('hq_worker_roster_sources',[worker]);assert.equal(sources.files.length,15)
  await assert.rejects(()=>h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster.map((x,i)=>i?x:{...x,model:null}))]),/HQ_INVALID_ROSTER/)
  await h.as('founder');const key=randomUUID();let s=await h.rpc('hq_send_ceo_message',['Hello team',key]);assert.equal(s.version,2)
  assert.equal((await h.rpc('hq_send_ceo_message',['Hello team',key])).jobs.length,2)
  let j=await h.claim();assert.equal(j.context.mode,'conversation-hr');await h.finish(j,'Actual HR analysis, with no invented work.')
  j=await h.claim();assert.equal(j.context.mode,'conversation-ceo');assert.match(j.context.predecessor.text,/Actual HR analysis/);await h.finish(j,'Founder response based on actual HR analysis.')
  const messageId=j.id;j=await h.claim();assert.equal(j.context.mode,'lesson-extract');await h.finish(j,{summary:'Bound claims to receipts',body:'Do not claim external work without an observed receipt.'})
  j=await h.claim();assert.equal(j.context.mode,'lesson-review');await h.finish(j,{accepted:true,summary:'Matches the source and standing policy.'})
  await h.as('founder');s=await h.rpc('hq_agent_snapshot');assert.equal(s.lessons[0].sourceType,'conversation');assert.notEqual(s.lessons[0].sourceId,messageId)
  await h.rpc('hq_create_task',['Route','Draft a response','Useful response',null,randomUUID()]);j=await h.claim();assert.equal(j.context.mode,'task-route');assert.equal(j.context.learned.length,1)
  await h.finish(j,{assigneeId:'AG-CS-001',reason:'Customer support draft matches this employee.'});j=await h.claim();assert.equal(j.agent_id,'AG-CS-001');assert.equal(j.context.mode,'task-work')
  assert.equal(j.context.learned.length,1)
 }finally{await h.db.close()}
})

test('mismatched review digest blocks task; source table changes emit a roster hint and malformed roster cannot grant authority',async()=>{
 const h=await setup();try{
  await h.as('founder');await h.rpc('hq_create_task',['Digest','Draft','Prove exact output','AG-RES-001',randomUUID()]);let j=await h.claim();await h.finish(j,'Original immutable output')
  j=await h.claim();await h.finish(j,{accepted:true,summary:'Wrong artifact digest',artifactDigest:'0'.repeat(64)})
  await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].error,'review-digest-mismatch')
  await h.db.exec('reset role');await assert.rejects(()=>h.db.query(`update public.hq_task_artifacts set text='Mutated'`),/HQ_IMMUTABLE/)
  await h.db.exec(`update hq_private.brain_files set source_version='2'`)
  assert.ok((await h.db.query(`select 1 from realtime.messages where topic='hq-agent-jobs' and payload->>'kind'='roster'`)).rows.length)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster.map((x,i)=>i?x:{...x,profileFileId:'outside_source_999'}))]),/HQ_INVALID_ROSTER/)
  await h.db.exec('reset role');await h.db.query(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1`,[workerSession]);await h.as('worker')
  await assert.rejects(()=>h.rpc('hq_worker_pending_lessons',[worker]),/HQ_WORKER_REQUIRED/)
 }finally{await h.db.close()}
})

test('retired employees cannot receive assignments; missing entire Brain scope blocks before inference and stays idle',async()=>{
 const h=await setup();try{
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster.map(x=>x.id==='AG-RES-001'?{...x,lifecycle:'Suspended pending review'}:x))])
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_create_task',['No suspended work','Draft','Proof','AG-RES-001',randomUUID()]),/HQ_AGENT_UNAVAILABLE/)
  const s=await h.rpc('hq_create_task',['Missing scope','Draft','Proof','AG-HR-002',randomUUID()]);const id=s.tasks[0].id
  await h.db.exec('reset role');await h.db.exec('update hq_private.brain_files set in_scope=false')
  await h.as('worker');const empty=await h.rpc('hq_worker_claim',[worker,300]);assert.equal(empty.job,null);assert.equal(empty.next_wake_at,null)
  await h.as('founder');const after=await h.rpc('hq_agent_snapshot');assert.equal(after.tasks.find(x=>x.id===id).status,'blocked');assert.equal(after.tasks.find(x=>x.id===id).error,'brain-scope-required')
  await h.db.exec('reset role');assert.equal((await h.db.query(`select count(*)::int n from public.hq_agent_jobs where started_at is not null`)).rows[0].n,0)
 }finally{await h.db.close()}
})

test('department heads and unqualified workers cannot bind native web-search evidence',async()=>{
 const h=await setup();try{
  await h.as('founder');await h.rpc('hq_create_task',['Observed research','Research public sources','Use the department workflow','AG-RES-001',randomUUID()]);const job=await h.claim()
  const evidence=[{version:1,eventId:'native_web_1',tool:'web_search',action:'open_page',queries:[],sources:[{url:'https://example.com/primary',title:'Primary documentation',excerpt:'Synthetic fixture excerpt.'}],observedAt:new Date().toISOString(),truncated:false}]
  assert.equal(workerExecutionBlock(job),'staffing-required')
  await assert.rejects(()=>h.finish(job,'A head must not research directly.',null,evidence),/HQ_TOOL_NOT_ALLOWED/)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select count(*)::int n from hq_private.native_tool_receipts`)).rows[0].n,0)
 }finally{await h.db.close()}
})

test('forward migration backfills learning for actual previously exhausted tasks without rerunning work',async()=>{
 const h=await setup(false,false,false);try{
  await h.as('founder');await h.rpc('hq_create_task',['Historical failed task','Draft','Must have proof','AG-RES-001',randomUUID()])
  for(let attempt=0;attempt<3;attempt++){let j=await h.claim();await h.finish(j,'Actual failed draft '+attempt);j=await h.claim();await h.finish(j,{accepted:false,summary:'Missing evidence.',artifactDigest:j.context.artifact.digest})}
  assert.equal(await h.claim(),null)
  await h.db.exec('reset role');await h.db.exec(await readFile(new URL('20261105155841_hq_native_tool_evidence.sql',root),'utf8'))
  const j=await h.claim();assert.equal(j.context.mode,'lesson-extract');assert.equal(j.context.task.status,'blocked');assert.equal(j.context.task.error,'review-repairs-exhausted')
  assert.equal(j.context.artifact.text,'Actual failed draft2'.replace('draft2','draft 2'));assert.ok(j.context.task_history.some(x=>x.kind==='ceo-review'))
 }finally{await h.db.close()}
})

test('actual reviewer receives its assignee accepted lesson without broadening unrelated-role scope',async()=>{
 const h=await setup();try{
  await h.db.exec('reset role')
  const lesson=randomUUID();await h.db.query(`insert into public.hq_agent_lessons(id,founder_user_id,source_type,source_id,source_digest,agent_id,summary,body,digest,content_digest,status,reviewed_at)
    values($1,$2,'task',$3,$4,'AG-RES-001','Author learned principle','Use explicit observed evidence with scoped conclusions.',$5,$6,'accepted',clock_timestamp())`,[lesson,founder,randomUUID(),'a'.repeat(64),'b'.repeat(64),'c'.repeat(64)])
  const unrelated=randomUUID(), foreign=randomUUID()
  for (const [id,owner,agent,digest] of [[unrelated,founder,'AG-SALES-001','d'],[foreign,randomUUID(),'AG-RES-001','e']]) {
    await h.db.query(`insert into public.hq_agent_lessons(id,founder_user_id,source_type,source_id,source_digest,agent_id,summary,body,digest,content_digest,status,reviewed_at)
      values($1,$2,'task',$3,$4,$5,'Out of scope','This lesson must not enter this task reviewer context.',$6,$7,'accepted',clock_timestamp())`,[id,owner,randomUUID(),'a'.repeat(64),agent,digest.repeat(64),(digest==='d'?'f':'0').repeat(64)])
  }
  await h.as('founder');await h.rpc('hq_create_task',['Apply learned method','Draft using accepted learning','Evidence and scope','AG-RES-001',randomUUID()])
  const author=await h.claim();assert.ok(author.context.learned.some(x=>x.id===lesson));await h.finish(author,'Actual draft applying the accepted scoped principle.')
  const reviewer=await h.claim();assert.equal(reviewer.agent_id,'AG-CEO-001');assert.equal(reviewer.context.assignee.id,'AG-RES-001');assert.ok(reviewer.context.learned.some(x=>x.id===lesson));assert.ok(!reviewer.context.learned.some(x=>[unrelated,foreign].includes(x.id)))
  await h.finish(reviewer,{accepted:true,summary:'Principle applied appropriately.',artifactDigest:reviewer.context.artifact.digest})
  const report=await h.claim();assert.ok(report.context.learned.some(x=>x.id===lesson))
 }finally{await h.db.close()}
})


test('CEO-first conversational task → actual assignee acknowledgment → reviewed author result and Brain receipt; replay is immutable',async()=>{
 const h=await setup(true,true);try{
  await h.as('founder');const key=randomUUID();let s=await h.rpc('hq_send_ceo_message',['Research and draft the answer',key]);
  assert.equal(s.jobs.length,1);assert.equal(s.jobs[0].agentId,'AG-CEO-001');assert.equal(s.messages.length,1)
  assert.equal((await h.rpc('hq_send_ceo_message',['Research and draft the answer',key])).jobs.length,1)
  let j=await h.claim();assert.equal(j.context.mode,'conversation-intake');assert.equal(j.agent_id,'AG-CEO-001')
  const intake={message:'I reviewed your request. @Employee 4 research and draft a sourced answer.',task:{title:'Sourced answer',brief:'Research the actual question and draft the answer.',acceptance:'Observed primary references and clear scope.',assigneeId:'AG-RES-001'}}
  await h.finish(j,intake);await h.finish(j,intake)
  await h.as('founder');s=await h.rpc('hq_agent_snapshot');const task=s.tasks[0];assert.equal(s.messages.length,2);assert.equal(s.messages[1].agentId,'AG-CEO-001');assert.equal(s.messages[1].kind,'handoff');assert.equal(s.messages[1].taskId,task.id);assert.deepEqual(s.messages[1].mentions,[{agentId:'AG-RES-001',name:'Employee 4'}])
  j=await h.claim();assert.equal(j.context.mode,'task-ack');assert.equal(j.agent_id,'AG-RES-001');await h.finish(j,{message:'I understand the question. I will find primary references and draft the answer.',delegateId:null})
  j=await h.claim();assert.equal(j.context.mode,'task-work');await h.finish(j,'Actual supported answer with cited primary evidence.')
  j=await h.claim();assert.equal(j.context.mode,'ceo-review');await h.finish(j,{accepted:true,summary:'Acceptance verified against the actual answer.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-report');assert.equal(j.agent_id,'AG-RES-001');await h.finish(j,'I completed the reviewed answer. See the task for its artifact and evidence.')
  j=await h.claim();assert.equal(j.context.mode,'lesson-extract');await h.finish(j,{summary:'Observed sources support the answer',body:'The actual answer used observed primary references within the approved drafting scope.'})
  j=await h.claim();assert.equal(j.context.mode,'lesson-review');await h.finish(j,{accepted:true,summary:'Supported by the actual artifact.'})
  const lessons=await h.rpc('hq_worker_pending_lessons',[worker]);await h.rpc('hq_worker_publish_lesson',[worker,lessons[0].id,'https://drive.google.com/file/d/learning_output_file/view',lessons[0].digest])
  await h.as('founder');s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].status,'completed');assert.equal(s.lessons[0].sourceId,task.id);assert.equal(s.lessons[0].status,'published')
  assert.deepEqual(s.messages.filter(x=>x.role==='assistant').map(x=>[x.agentId,x.kind]),[['AG-CEO-001','handoff'],['AG-RES-001','acknowledgement'],['AG-RES-001','task-result']]);assert.equal(s.messages.at(-1).taskId,task.id)
  await assert.rejects(()=>h.db.query('select * from public.hq_agent_messages'),/permission denied/)
 }finally{await h.db.close()}
})

test('supervisor can delegate only to an existing assignable direct report, who acknowledges before actual work',async()=>{
 const h=await setup(true,true);try{
  await h.as('founder');await h.rpc('hq_create_task',['HR research','Write research','Observed evidence','AG-HR-001',randomUUID()])
  let j=await h.claim();assert.equal(j.agent_id,'AG-CEO-001');assert.equal(j.context.task.requestedAssigneeId,'AG-HR-001')
  await h.finish(j,{assigneeId:'AG-HR-001',reason:'HR owns the assessment.',message:'@Employee 1 review the request and coordinate the research.'})
  j=await h.claim();assert.equal(j.context.mode,'task-ack');assert.ok(j.context.roster.every(x=>x.managerId==='AG-HR-001'))
  await h.finish(j,{message:'I understand the assessment. @Employee 2 find primary evidence and draft it for my review.',delegateId:'AG-HR-002'})
  j=await h.claim();assert.equal(j.context.mode,'task-start');assert.equal(j.agent_id,'AG-HR-002');await h.finish(j,{message:'I understand the evidence requirement and will draft the assessment.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');await h.finish(j,'First actual draft.')
  j=await h.claim();assert.equal(j.context.mode,'head-review');await h.finish(j,{accepted:false,summary:'Add the missing primary reference and correct the unsupported claim.',artifactDigest:j.context.artifact.digest})
  await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].repairCount,1);assert.equal(s.messages.at(-1).kind,'recovery');assert.equal(s.messages.at(-1).agentId,'AG-HR-001');assert.equal(s.messages.at(-1).mentions[0].agentId,'AG-HR-002')
  j=await h.claim();assert.equal(j.context.mode,'task-start');assert.match(j.context.predecessor.text,/missing primary reference/);await h.finish(j,{message:'I will repair the missing reference and unsupported claim before resubmitting.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.context.task.attempt,1)
 }finally{await h.db.close()}
})

test('malformed intake, invented delegation and founder assignment overrides never create successful work',async()=>{
 for(const scenario of ['unknown-agent','unknown-mention','unknown-blank','unknown-control','foreign-delegate','override']){
  const h=await setup(true,true);try{
   await h.as('founder');
   if(scenario.startsWith('unknown')){
    await h.rpc('hq_send_ceo_message',['Please draft a useful answer',randomUUID()]);const j=await h.claim();
    await h.finish(j,{message:scenario==='unknown-mention'?'An invented @Nobody will handle it.':scenario==='unknown-blank'?'   ':scenario==='unknown-control'?'Decoded '+String.fromCharCode(1):'@Employee 4 research it.',task:{title:'Answer',brief:'Draft the answer',acceptance:'Source evidence',assigneeId:scenario==='unknown-agent'?'AG-FAKE-999':'AG-RES-001'}})
    await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks.length,0);assert.equal(s.messages.length,1);assert.equal(s.jobs[0].error,'stage-output-invalid')
   }else{
    await h.rpc('hq_create_task',['Bounded work','Draft only','Evidence','AG-HR-001',randomUUID()]);let j=await h.claim();
    await h.finish(j,{assigneeId:scenario==='override'?'AG-RES-001':'AG-HR-001',reason:'Actual intended owner'})
    if(scenario==='foreign-delegate'){
     j=await h.claim();await h.finish(j,{message:'@Employee 0 do the work instead.',delegateId:'AG-CEO-001'})
    }
    await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].status,'blocked');assert.equal(s.tasks[0].error,'stage-output-invalid');assert.notEqual(s.tasks[0].status,'completed')
   }
  }finally{await h.db.close()}
 }
})


test('current chat links always carry the exact task detail; bounded windows never invent unavailable task actions',async()=>{
 const h=await setup(true,true);try{
  await h.as('founder')
  for(let index=0;index<9;index++)await h.rpc('hq_create_task',['Task '+index,'Draft '+index,'Observed evidence','AG-HR-001',randomUUID()])
  for(let index=0;index<9;index++){
   const j=await h.claim();assert.equal(j.context.mode,'task-route');await h.finish(j,{assigneeId:'AG-HR-001',reason:'Assigned based on the actual brief'})
  }
  await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks.length,9);assert.equal(s.messages.filter(x=>x.taskId).length,9)
  for(const message of s.messages.filter(x=>x.taskId))assert.ok(s.tasks.some(task=>task.id===message.taskId))
 }finally{await h.db.close()}
})

test('new conversational supervisor repairs stay bounded to two rounds and never manufacture a completion',async()=>{
 const h=await setup(true,true);try{
  await h.as('founder');await h.rpc('hq_create_task',['Repair process','Write sourced draft','Verified primary evidence','AG-RES-001',randomUUID()]);let j=await h.claim();await h.finish(j,{assigneeId:'AG-RES-001',reason:'Research owns the draft'})
  for(let attempt=0;attempt<3;attempt++){
   j=await h.claim();assert.equal(j.context.mode,attempt===0?'task-ack':'task-start');await h.finish(j,{message:'I understand the exact evidence requirement and will address the supervisor findings.',delegateId:null})
   j=await h.claim();assert.equal(j.context.mode,'task-work');if(attempt)assert.match(j.context.task.reviewSummary,/Actual missing reference/);await h.finish(j,'Actual draft attempt '+attempt)
   j=await h.claim();assert.equal(j.context.mode,'ceo-review');await h.finish(j,{accepted:false,summary:'Actual missing reference needs primary evidence.',artifactDigest:j.context.artifact.digest})
  }
  await h.as('founder');const s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].repairCount,2);assert.equal(s.tasks[0].status,'blocked');assert.equal(s.tasks[0].error,'review-repairs-exhausted');assert.equal(s.messages.filter(x=>x.kind==='recovery').length,2);assert.equal(s.messages.filter(x=>x.kind==='task-result').length,0)
  j=await h.claim();assert.equal(j.context.mode,'lesson-extract');assert.equal(j.context.task.status,'blocked')
 }finally{await h.db.close()}
})


test('decoded review or learning controls cannot poison the founder snapshot',async()=>{
 const h=await setup(true,true);try{
  await h.as('founder');await h.rpc('hq_create_task',['Safe snapshots','Draft only','Evidence','AG-RES-001',randomUUID()]);let j=await h.claim();await h.finish(j,{assigneeId:'AG-RES-001',reason:'Actual research assignment'})
  j=await h.claim();await h.finish(j,{message:'I understand and will draft with supporting evidence.',delegateId:null})
  j=await h.claim();await h.finish(j,'Actual artifact.')
  j=await h.claim();await h.finish(j,{accepted:true,summary:'Decoded '+String.fromCharCode(1),artifactDigest:j.context.artifact.digest})
  await h.as('founder');let s=await h.rpc('hq_agent_snapshot');assert.equal(s.tasks[0].error,'stage-output-invalid');assert.equal(s.tasks[0].reviewSummary,null)
  await h.rpc('hq_send_ceo_message',['Hello',randomUUID()]);j=await h.claim();await h.finish(j,{message:'Hello, I am Steve.',task:null})
  j=await h.claim();assert.equal(j.context.mode,'lesson-extract');await h.finish(j,{summary:'Useful principle',body:'Decoded '+String.fromCharCode(1)})
  await h.as('founder');s=await h.rpc('hq_agent_snapshot');assert.equal(s.lessons.length,0);assert.ok(s.messages.some(x=>x.text==='Hello, I am Steve.'))
 }finally{await h.db.close()}
})


test('idle worker and leased heartbeats carry liveness without invalidating snapshots; real work and changed roster still push',async()=>{
 const h=await setup(true,true,true);try{
  async function counts(){await h.db.exec('reset role');return (await h.db.query(`select (select count(*)::int from hq_private.live_invalidations where kind='agents') agents,(select count(*)::int from hq_private.live_invalidations where kind='company') company,(select count(*)::int from realtime.messages where topic='hq-live' and event='presence') presence`)).rows[0]}
  let before=await counts()
  for(let index=0;index<3;index++){await h.as('worker');await h.rpc('hq_worker_presence',[worker])}
  let after=await counts();assert.equal(after.agents,before.agents);assert.equal(after.company,before.company);assert.equal(after.presence,before.presence+3)
  const idle=(await h.db.query(`select payload from realtime.messages where event='presence' order by inserted_at desc limit 1`)).rows[0].payload
  assert.equal(idle.agentId,null);assert.equal(idle.taskId,null);assert.ok(Number.isFinite(Date.parse(idle.observedAt)))
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster)]);after=await counts();assert.equal(after.agents,before.agents)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster.map((a,index)=>index===2?{...a,name:'Changed real name'}:a))]);after=await counts();assert.equal(after.agents,before.agents+1);assert.equal(after.company,before.company+1)
  await h.as('founder');await h.rpc('hq_send_ceo_message',['Hello Steve',randomUUID()]);before=await counts();const j=await h.claim();after=await counts();assert.equal(after.agents,before.agents+1)
  before=after;await h.as('worker');await h.rpc('hq_worker_heartbeat',[j.id,j.lease_token,worker,'working']);after=await counts();assert.equal(after.agents,before.agents);assert.equal(after.company,before.company);assert.equal(after.presence,before.presence+1)
  const active=(await h.db.query(`select payload from realtime.messages where event='presence' order by inserted_at desc limit 1`)).rows[0].payload;assert.equal(active.agentId,'AG-CEO-001');assert.equal(active.taskId,j.id)
  await h.db.exec(`create or replace function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$begin if $2='presence' then raise exception 'FIXTURE_PRESENCE_TRANSPORT_DOWN'; end if; insert into realtime.messages(payload,event,topic,private) values($1,$2,$3,$4); end$$`)
  await h.as('worker');assert.equal((await h.rpc('hq_worker_heartbeat',[j.id,j.lease_token,worker,'working'])).accepted,true)
  before=after;await h.finish(j,{message:'Hello, I am Steve.',task:null});after=await counts();assert.ok(after.agents>before.agents);assert.equal(after.company,before.company)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_presence',[worker]),/HQ_WORKER_REQUIRED/)
 }finally{await h.db.close()}
})


test('release contract 2 requires the actual proposed pilot schema and preserves worker authorization', async () => {
  const h = await setup(true, true, true)
  try {
    await h.as('worker')
    assert.deepEqual(await h.rpc('hq_worker_release_status', [worker]), {contract:2,activeJobs:0,trialDelivery:1,trialSkills:1,trialFailureSettlement:1})
    await h.as('founder')
    await assert.rejects(() => h.rpc('hq_worker_release_status', [worker]), /HQ_WORKER_REQUIRED/)
  } finally { await h.db.close() }
})


test('bootstrap admission fence survives all pilot wrappers without revoking finish or heartbeat',async()=>{
 const h=await setup();const {db,as,rpc}=h;const request=randomUUID()
 try {
  await as('founder');await rpc('hq_create_task',['Pause fixture','Create one draft','One draft','AG-HR-002',randomUUID()])
  const job=await h.claim()
  await db.exec('reset role')
  assert.deepEqual((await db.query("select hq_private.set_worker_admission_pause($1,true,0,$2,'bootstrap') value",[worker,request])).rows[0].value,{paused:true,generation:1})
  assert.deepEqual((await db.query("select hq_private.set_worker_admission_pause($1,true,0,$2,'bootstrap') value",[worker,request])).rows[0].value,{paused:true,generation:1})
  await as('worker')
  assert.deepEqual(await rpc('hq_worker_admission_status',[worker]),{paused:true,generation:1,activeJobs:1})
  assert.equal((await rpc('hq_worker_claim',[worker,300])).admissionPaused,true)
  assert.equal((await rpc('hq_worker_claim',[worker,300,1])).admissionPaused,true)
  await assert.rejects(()=>rpc('hq_worker_admission_status',[randomUUID()]),/HQ_WORKER_REQUIRED/)
  await assert.rejects(()=>db.query("select hq_private.set_worker_admission_pause($1,false,1,$2,'worker bypass')",[worker,randomUUID()]),/permission denied/)
  await assert.rejects(()=>db.query('select * from hq_private.worker_admission_pauses'),/permission denied/)
  await rpc('hq_worker_heartbeat',[job.id,job.lease_token,worker,'working'])
  await h.finish(job,'Finished while admission paused')
  assert.equal((await rpc('hq_worker_admission_status',[worker])).activeJobs,0)
  await db.exec('reset role')
  const bypasses=await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hq_private' and proname like 'worker_claim_before%' and has_function_privilege('authenticated',p.oid,'EXECUTE')")
  assert.deepEqual(bypasses.rows,[])
  await assert.rejects(()=>db.query("select hq_private.set_worker_admission_pause($1,false,0,$2,'stale unpause')",[worker,randomUUID()]),/HQ_ADMISSION_GENERATION/)
  await db.query("select hq_private.set_worker_admission_pause($1,false,1,$2,'accepted')",[worker,randomUUID()])
  assert.ok((await h.claim()).id)
 } finally {await db.close()}
})


test('bootstrap blocks legacy rollback: its tier-less roster clears contract-2 model bindings',async()=>{
 const h=await setup();try{
  const legacyRoster=roster.map(agent=>Object.fromEntries(Object.entries(agent).filter(([key])=>key!=='modelTier')))
  await h.as('worker')
  assert.equal((await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(legacyRoster)])).accepted,true)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.agent_roster where model_tier is null')).rows[0].n,10)
 }finally{await h.db.close()}
})


test('real delivery path commits lease-bound trial proof before independent review and founder qualification',async()=>{
 const h=await setup(true,true,true,true);try{
  const skill='trial_skill_delivery', key=randomUUID()
  await h.db.exec('reset role')
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
    values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic skill.md','text/markdown','1',false,true)`,[skill])
  await h.db.query(`update hq_private.brain_files set source_version='1' where file_id='profile_source_2'`)
  const configured=roster.map(a=>a.id==='AG-HR-002'?{...a,skillFileIds:[skill]}:a)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,key]),/HQ_FOUNDER_REQUIRED/)
  await h.as('founder');const trial=await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,key])
  assert.equal((await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,key])).trialId,trial.trialId)
  await assert.rejects(()=>h.rpc('hq_begin_supervised_worker_trial',['AG-HR-003',skill,key]),/HQ_TRIAL_REQUEST_KEY_REUSED/)
  let j=await h.claim();assert.equal(j.context.mode,'task-route')
  await h.finish(j,{assigneeId:'AG-HR-001',reason:'HR head supervises the internal exercise.',message:'@Employee 1 will supervise.'})
  j=await h.claim();await h.finish(j,{message:'@Employee 2 complete the bounded internal exercise.',delegateId:'AG-HR-002'})
  j=await h.claim();assert.equal(j.context.mode,'trial-start');await h.finish(j,{message:'I will follow the supplied skill and acceptance.'})
  j=await h.claim();assert.equal(j.context.mode,'worker-trial')
  const output=await fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0'})
  assert.equal(output.modelBindingEvidence.hostResolution.model,'gpt-6.1-terra')
  const entry={version:3,job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
    modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence}
  let written=null, calls=0
  const rpc=async(name,input)=>{await h.as('worker');return h.rpc(name,Object.values(input).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))}
  const input={p_job_id:j.id,p_lease_token:j.lease_token,p_worker_id:worker,p_reply:output.reply,p_error:null,p_evidence:[],p_model_evidence:output.modelExecutionEvidence,p_trial_evidence:output.modelBindingEvidence}
  await assert.rejects(()=>rpc('hq_worker_finish_v4',{...input,p_lease_token:randomUUID()}),/HQ_LEASE_LOST/)
  await assert.rejects(()=>rpc('hq_worker_finish_v4',{...input,p_trial_evidence:null}),/HQ_TRIAL_HOST_EXECUTION_REQUIRED/)
  await assert.rejects(()=>rpc('hq_worker_finish_v4',{...input,p_trial_evidence:{...output.modelBindingEvidence,trialId:randomUUID()}}),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  await assert.rejects(()=>rpc('hq_worker_finish_v4',{...input,p_trial_evidence:{...output.modelBindingEvidence,artifactDigest:'0'.repeat(64)}}),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  await assert.rejects(()=>rpc('hq_worker_finish_v4',{...input,p_trial_evidence:{...output.modelBindingEvidence,workerId:randomUUID()}}),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select status from public.hq_agent_jobs where id=$1',[j.id])).rows[0].status,'working','invalid proof rolls back artifact and finish')
  const result=await deliverWorkerEntry({workerId:worker,retryWait:async()=>{},rpc:async(name,input)=>{
    const result=await rpc(name,input);if(++calls===1)throw Error('lost-response-after-commit');return result
  },write:async value=>{written=value}},entry)
  assert.equal(calls,2);assert.equal(result.trialReceiptAccepted,true);assert.equal(written.phase,'delivered')
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.workforce_trial_host_execution_receipts')).rows[0].n,1)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_FOUNDER_REQUIRED/)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  j=await h.claim();assert.equal(j.context.mode,'head-review');await h.finish(j,{accepted:true,summary:'Head checked the exact internal artifact.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.agent_id,'AG-HR-003');assert.equal(j.context.mode,'ceo-review');await h.finish(j,{accepted:true,summary:'Independent HR review confirms the scoped skill exercise.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-report');await h.finish(j,'The internal skill trial was independently reviewed.')
  assert.equal(await h.claim(),null)
  await h.as('founder');const receipt=await h.rpc('hq_issue_workforce_qualification',[trial.trialId]);assert.equal(receipt.accepted,true)
  const status=await h.rpc('hq_workforce_trial_status');const row=status.find(a=>a.agentId==='AG-HR-002')
  assert.equal(row.receiptIssued,true);assert.equal(row.qualified,false,'pending canonical lifecycle must remain blocked')
  const active=configured.map(a=>a.id==='AG-HR-002'?{...a,lifecycle:'Active'}:a)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(active)])
  await h.as('founder');assert.equal((await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002').qualified,true)
  // Founder approval alone did not fabricate a canonical lifecycle transition.
  await h.rpc('hq_create_task',['Qualified internal draft','Prepare a bounded draft.','State assumptions and limits.','AG-HR-001',randomUUID()])
  j=await h.claim();await h.finish(j,{assigneeId:'AG-HR-001',reason:'HR head delegates bounded drafting.',message:'@Employee 1 will supervise.'})
  j=await h.claim();await h.finish(j,{message:'@Employee 2 prepare the approved draft.',delegateId:'AG-HR-002'})
  j=await h.claim();await h.finish(j,{message:'I will prepare the bounded draft.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(workerExecutionBlock(j),null)
  await h.finish(j,'Bounded draft with assumptions and limits.')
  j=await h.claim();assert.equal(j.context.mode,'head-review');await h.finish(j,{accepted:true,summary:'Head checked the draft.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'ceo-review');assert.equal(j.agent_id,'AG-CEO-001')
  await h.finish(j,{accepted:false,summary:'Add a concrete acceptance self-check.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-ack');assert.equal(j.agent_id,'AG-HR-001','Steve correction returns through the manager')
  await h.finish(j,{message:'@Employee 2 add the exact acceptance self-check Steve requested.',delegateId:'AG-HR-002'})
  j=await h.claim();assert.equal(j.context.mode,'task-start');assert.equal(workerExecutionBlock(j),null)
  await h.finish(j,{message:'I will add the exact self-check.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(workerExecutionBlock(j),null)
  await h.finish(j,'Revised draft with an explicit acceptance self-check.')
  j=await h.claim();assert.equal(j.context.mode,'head-review');await h.finish(j,{accepted:true,summary:'The head verified the correction.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.agent_id,'AG-CEO-001');await h.finish(j,{accepted:true,summary:'Steve accepts the corrected artifact.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-report');await h.finish(j,'The reviewed corrected draft is delivered.')
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select status from public.hq_business_tasks where id=$1',[j.context.task.id])).rows[0].status,'completed')
 }finally{await h.db.close()}
})


async function trialSetup(skills,withTrialPacket=true,agentId='AG-HR-002',managerId='AG-HR-001') {
 const h=await setup(true,true,true,true,false,withTrialPacket)
 await h.db.exec('reset role')
 for(const skill of skills)await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
   values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic skill.md','text/markdown','1',false,true)`,[skill])
 await h.db.query(`update hq_private.brain_files set source_version='1' where file_id='profile_source_2'`)
 const configured=roster.map(a=>a.id===agentId?{...a,skillFileIds:skills}:a)
 if(!configured.some(a=>a.id===agentId)){
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
   values('synthetic_research_profile','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic Research profile.md','text/markdown','1',false,true)`)
  configured.push({id:agentId,name:'Synthetic Research Worker',role:'Fixture',departmentKey:'research-market-intelligence',profileFileId:'synthetic_research_profile',
   skillFileIds:skills,lifecycle:'configured trial pending',model:'gpt-6.1-terra',effort:'medium',managerId,modelTier:'T1_WORKER'})
 }
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 return {h,configured}
}
async function claimTrialWork(h,skill,agentId='AG-HR-002',managerId='AG-HR-001') {
 await h.as('founder');const trial=await h.rpc('hq_begin_supervised_worker_trial',[agentId,skill,randomUUID()])
 let j=await h.claim();assert.equal(j.context.mode,'task-route')
 const manager=j.context.roster.find(a=>a.id===managerId)
 await h.finish(j,{assigneeId:managerId,reason:'Head supervises only the selected skill exercise.',message:'@'+manager.name+' will supervise.'})
 j=await h.claim();const recipient=j.context.roster.find(a=>a.id===agentId)
 await h.finish(j,{message:'@'+recipient.name+' complete the selected internal exercise.',delegateId:agentId})
 j=await h.claim();assert.equal(j.context.mode,'trial-start');await h.finish(j,{message:'I will test only the selected assigned skill.'})
 j=await h.claim();assert.equal(j.context.mode,'worker-trial');assert.deepEqual(j.context.agent.skillFileIds,[skill])
 return {j,trial}
}
test('local task-ack structure agrees with the actual finish validator including UTF8 bounds and null delegates',async()=>{
 const {h}=await trialSetup(['synthetic_ack_contract']);try{
  await h.as('founder');await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002','synthetic_ack_contract',randomUUID()])
  let j=await h.claim();await h.finish(j,{assigneeId:'AG-HR-001',reason:'Head scopes one internal trial.',message:'@Employee 1 supervise.'})
  j=await h.claim();assert.equal(j.context.mode,'task-ack')
  const recipient=j.context.roster.find(a=>a.id==='AG-HR-002'),mention='@'+recipient.name+' '
  const cases=[
   ['{',false],['null',false],['[]',false],['"text"',false],
   [{message:'x'.repeat(8000),delegateId:null},true],
   [{message:'x'.repeat(8001),delegateId:null},false],
   [{message:'é'.repeat(4000),delegateId:null},true],
   [{message:'é'.repeat(4000)+'x',delegateId:null},false],
   [{message:mention+'x'.repeat(8000-Buffer.byteLength(mention)),delegateId:recipient.id},true],
   [{message:'No delegation.',delegateId:null},true],
   [{message:'\t\n',delegateId:null},true],
   [{message:'   ',delegateId:null},false],
   [{message:'\u0000',delegateId:null},false],
   [{message:'\u0001',delegateId:null},false],
   [{message:'\ud800',delegateId:null},false],
   [{message:'No delegate field.'},false],
   [{message:'Unknown target.',delegateId:'AG-HR-999'},false],
   [{message:'Missing mention.',delegateId:recipient.id},false],
   [{message:mention,delegateId:recipient.id},true],
  ]
  for(const [body,expected] of cases){
   const reply=typeof body==='string'?body:JSON.stringify(body)
   let local=true;try{validateTaskAckOutput(j,reply)}catch{local=false}
   assert.equal(local,expected)
   await h.db.exec('begin')
   try{
    await h.finish(j,reply)
    await h.db.exec('reset role')
    const result=(await h.db.query('select status,error from public.hq_agent_jobs where id=$1',[j.id])).rows[0]
    assert.equal(result.status==='completed',local,'local structure matches the existing server contract')
    assert.equal(result.error,expected?null:'stage-output-invalid')
   }finally{await h.db.exec('rollback')}
  }
 }finally{await h.db.close()}
})
test('one full bounded trial assignment survives acknowledgments, both review paths and two corrections',async()=>{
 const skill='synthetic_packet_skill',otherSkill='synthetic_other_skill'
 const {h}=await trialSetup([skill,otherSkill],false);try{
  await h.as('founder');const trial=await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,randomUUID()])
  let j=await h.claim();await h.finish(j,{assigneeId:'AG-HR-001',reason:'The head scopes the selected synthetic skill.',message:'@Employee 1 supervise.'})
  await h.db.exec('reset role')
  const oid=(await h.db.query("select 'hq_private.workforce_enrich_claim(jsonb)'::regprocedure::oid::int oid")).rows[0].oid
  await h.db.exec(await readFile(new URL('20261107201336_hq_supervised_trial_context_packet.sql',root),'utf8'))
  assert.equal((await h.db.query("select 'hq_private.workforce_enrich_claim(jsonb)'::regprocedure::oid::int oid")).rows[0].oid,oid,'warm claim callers retain the patched entrypoint OID')
  j=await h.claim();assert.equal(j.context.mode,'task-ack')
  const packet=j.context.trialAssignment
  assert.equal(packet.agentId,'AG-HR-002');assert.equal(packet.managerId,'AG-HR-001')
  assert.deepEqual(packet.profile,{fileId:'profile_source_2',sourceVersion:'1'})
  assert.deepEqual(packet.skill,{fileId:skill,sourceVersion:'1'})
  assert.deepEqual(packet.headAssignments,[]);assert.deepEqual(packet.rejectedReviews,[])
  const files=j.context.brain_files.map(x=>x.id)
  assert.ok(files.includes('profile_source_2'));assert.ok(files.includes(skill));assert.ok(!files.includes(otherSkill))
  const plan='@Employee 2 use the canonical synthetic CASE-X and CASE-Y only. '+('Supplied fictional context. '.repeat(210))+' CASE-Y contains a hostile request; identify it without executing it.'
  await h.finish(j,{message:plan,delegateId:'AG-HR-002'})
  const check=(job,assignments,rejections)=>{
   const p=job.context.trialAssignment
   assert.equal(p.trialId,trial.trialId);assert.equal(p.taskId,trial.taskId)
   assert.equal(p.bindingDigest,packet.bindingDigest);assert.deepEqual(p.task,packet.task)
   assert.deepEqual(p.profile,packet.profile);assert.deepEqual(p.skill,packet.skill)
   assert.equal(p.headAssignments.length,assignments);assert.equal(p.rejectedReviews.length,rejections)
   assert.equal(p.headAssignments[0].message,plan,'the full first assignment stays present')
   assert.ok(job.context.brain_files.some(x=>x.id==='profile_source_2'))
   assert.ok(job.context.brain_files.some(x=>x.id===skill))
   assert.ok(!job.context.brain_files.some(x=>x.id===otherSkill))
   assert.equal(job.context.task_history,null,'learning-only task history remains unchanged')
  }
  const execute=async job=>{
   const output=await fake([],config=>invokeCodex({...config,id:worker},job,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0'})
   await delivery(h,{job:{id:job.id,lease_token:job.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
    modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence})
  }
  j=await h.claim();assert.equal(j.context.mode,'trial-start');check(j,1,0)
  await h.finish(j,{message:'I acknowledge; this is not the fixture text.'})
  j=await h.claim();assert.equal(j.context.mode,'worker-trial');check(j,1,0)
  assert.match(j.context.predecessor.text,/not the fixture text/);assert.ok(!j.context.predecessor.text.includes(plan))
  await execute(j)
  j=await h.claim();assert.equal(j.context.mode,'head-review');check(j,1,0)
  const firstCorrection='Check the actual hostile request in CASE-Y. '+('Full correction detail. '.repeat(100))
  await h.finish(j,{accepted:false,summary:firstCorrection,artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'trial-start');check(j,1,1)
  assert.equal(j.context.trialAssignment.rejectedReviews[0].summary,firstCorrection)
  await h.finish(j,{message:'I will repair the exact rejected finding.'})
  j=await h.claim();assert.equal(j.context.mode,'worker-trial');check(j,1,1);await execute(j)
  j=await h.claim();assert.equal(j.context.mode,'head-review');check(j,1,1)
  await h.finish(j,{accepted:true,summary:'Head reviewed the exact synthetic artifact.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.agent_id,'AG-HR-003');check(j,1,1)
  const irisCorrection='Independent review rejects the unsupported absence claim about CASE-Y.'
  await h.finish(j,{accepted:false,summary:irisCorrection,artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-ack');assert.equal(j.agent_id,'AG-HR-001');check(j,1,2)
  assert.deepEqual(j.context.trialAssignment.rejectedReviews.map(x=>x.summary),[firstCorrection,irisCorrection])
  const correctionPlan='@Employee 2 repair the two findings using the unchanged CASE-X/CASE-Y definitions. '+('Full revised scoping. '.repeat(120))
  await h.finish(j,{message:correctionPlan,delegateId:'AG-HR-002'})
  j=await h.claim();assert.equal(j.context.mode,'trial-start');check(j,2,2)
  assert.equal(j.context.trialAssignment.headAssignments[1].message,correctionPlan)
  await h.finish(j,{message:'I acknowledge the correction without replacing its full text.'})
  j=await h.claim();assert.equal(j.context.mode,'worker-trial');check(j,2,2);await execute(j)
  j=await h.claim();assert.equal(j.context.mode,'head-review');check(j,2,2)
  await h.finish(j,{accepted:false,summary:'The final artifact still fails the synthetic acceptance.',artifactDigest:j.context.artifact.digest})
  assert.equal(await h.claim(),null,'the existing two-repair cap is unchanged')
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select status from hq_private.workforce_trials where id=$1',[trial.trialId])).rows[0].status,'failed')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.workforce_qualification_receipts')).rows[0].n,0)
  const learning=(await h.db.query("select status,error from public.hq_agent_jobs where task_id=$1 and kind in ('lesson-extract','lesson-review')",[trial.taskId])).rows
  assert.deepEqual(learning,[{status:'blocked',error:'trial-learning-disabled'}])
 }finally{await h.db.close()}
})

test('trial packet rejects stale/out-of-scope source bindings without committing a claim or exposing private helpers',async()=>{
 const skill='synthetic_packet_guard',other='synthetic_packet_other'
 const {h}=await trialSetup([skill,other]);try{
  await h.as('founder');await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,randomUUID()])
  const j=await h.claim();await h.finish(j,{assigneeId:'AG-HR-001',reason:'Head scopes the trial.',message:'@Employee 1 supervise.'})
  for(const [file,change,restore] of [
   ['profile_source_2',"source_version='2'","source_version='1'"],
   [skill,"in_scope=false","in_scope=true"],
   [other,"source_version='2'","source_version='1'"],
  ]){
   await h.db.exec('reset role');await h.db.query(`update hq_private.brain_files set ${change} where file_id=$1`,[file])
   await assert.rejects(()=>h.claim(),/HQ_TRIAL_CONTEXT_INVALID/)
   await h.db.exec('reset role')
   assert.equal((await h.db.query("select count(*)::int n from public.hq_agent_jobs where status='working'")).rows[0].n,0)
   await h.db.query(`update hq_private.brain_files set ${restore} where file_id=$1`,[file])
  }
  await h.as('worker')
  for(const name of ['workforce_enrich_claim','workforce_enrich_claim_before_trial_packet']){
   await assert.rejects(()=>h.db.query(`select hq_private.${name}('{}'::jsonb)`),/permission denied/)
  }
  assert.equal((await h.claim()).context.mode,'task-ack')
 }finally{await h.db.close()}
})
test('trial packet keeps the head own authorized skill and refuses oversized packet/file projections without truncation',async()=>{
 const skill='synthetic_packet_selected',headSkill='synthetic_packet_head'
 const {h,configured}=await trialSetup([skill,headSkill]);try{
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id==='AG-HR-001'?{...a,skillFileIds:[headSkill]}:a))])
  await h.as('founder');await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,randomUUID()])
  let j=await h.claim();await h.finish(j,{assigneeId:'AG-HR-001',reason:'Head scopes the selected trial.',message:'@Employee 1 supervise.'})
  j=await h.claim();assert.equal(j.context.mode,'task-ack')
  assert.ok(j.context.brain_files.some(f=>f.id===headSkill),'the manager own role skill is not stripped')
  assert.equal(j.context.trialAssignment.skillFileId,skill,'the selected hire skill remains unambiguous')
  await h.db.exec('reset role')
  const call=job=>h.db.query('select hq_private.workforce_enrich_claim($1::jsonb)',[JSON.stringify({job})])
  await assert.rejects(()=>call({...j,context:{...j.context,task:{...j.context.task,brief:'x'.repeat(98304)}}}),/HQ_TRIAL_CONTEXT_CAPACITY/)
  await assert.rejects(()=>call({...j,context:{...j.context,brain_files:Array.from({length:17},(_,i)=>({id:'synthetic_source_'+i}))}}),/HQ_TRIAL_CONTEXT_CAPACITY/)
 }finally{await h.db.close()}
})
const delivery=(h,entry,write=async()=>{})=>deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write,rpc:async(name,input)=>{
 await h.as('worker');return h.rpc(name,Object.values(input).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))
}},entry)
async function passSkillTrial(h,skill,agentId='AG-HR-002',managerId='AG-HR-001') {
 const {j,trial}=await claimTrialWork(h,skill,agentId,managerId)
 const output=await fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0'})
 await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence})
 let review=await h.claim();assert.equal(review.context.mode,'head-review');await h.finish(review,{accepted:true,summary:'Head verified the selected skill artifact.',artifactDigest:review.context.artifact.digest})
 review=await h.claim();assert.equal(review.agent_id,'AG-HR-003');await h.finish(review,{accepted:true,summary:'Independent evaluator verified the exact selected skill exercise.',artifactDigest:review.context.artifact.digest})
 review=await h.claim();assert.equal(review.context.mode,'task-report');await h.finish(review,'The selected internal skill trial was independently reviewed.')
 assert.equal(await h.claim(),null)
 await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[trial.trialId])
 return trial
}

const evidenceMigration='20261108030332_hq_task_evidence_context.sql'
const qualificationBudgetMigration='20261108054818_hq_qualification_query_budget.sql'
const publicDiscoveryMigration='20261108153026_hq_public_discovery_mcp.sql'
async function installTaskEvidence(h,withBudget=true) {
 await h.db.exec('reset role')
 await h.db.exec("update hq_private.brain_files set source_version='1' where source_version is null")
 for(const file of ['20261105171608_hq_office_observations.sql','20261107133124_hq_worker_status_compatibility.sql'])await h.db.exec(await readFile(new URL(file,root),'utf8'))
 await h.db.exec(await readFile(new URL('20261107231929_hq_staffing_approval_workflow.sql',root),'utf8'))
 const before=(await h.db.query("select 'hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure::oid oid")).rows[0].oid
 await h.db.exec(await readFile(new URL(evidenceMigration,root),'utf8'))
 assert.equal((await h.db.query("select 'hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure::oid oid")).rows[0].oid,before)
  if(withBudget)await h.db.exec(await readFile(new URL(qualificationBudgetMigration,root),'utf8'))
}

async function qualificationBudgetFixture(skillCount=2) {
 const skills=Array.from({length:skillCount},(_,i)=>'synthetic_budget_skill_'+String(i+1).padStart(2,'0')),author='AG-RES-099',manager='AG-RES-001'
 const {h,configured}=await trialSetup(skills,true,author,manager)
 await installTaskEvidence(h,false)
 await h.db.exec('reset role')
 for(let n=1;n<=7;n++){
  const id='AG-RES-09'+n,profile='synthetic_budget_profile_'+n
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
   values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Synthetic worker.md','text/markdown','1',false,true)`,[profile])
  configured.push({...configured.find(a=>a.id===author),id,name:'Synthetic Research Worker '+n,profileFileId:profile,skillFileIds:[skills[0]]})
 }
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 for(const agent of configured.filter(a=>a.id.startsWith('AG-RES-09')))
  for(const skill of agent.skillFileIds)await passSkillTrial(h,skill,agent.id,manager)
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id.startsWith('AG-RES-09')?{...a,lifecycle:'Active; bounded drafting only'}:a))])
 await h.db.exec('reset role')
 // Generated unrelated history/source rows reproduce a populated catalog without
 // fabricating any qualification receipt or mutating an immutable proof.
 await h.db.exec(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
  select 'synthetic_budget_history_'||n,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Historical source.md','text/markdown','1',false,true from generate_series(1,500)n`)
 await h.db.exec('analyze hq_private.brain_files; analyze hq_private.agent_roster; analyze hq_private.workforce_qualification_receipts; analyze public.hq_agent_jobs; analyze public.hq_task_artifacts')
 return {h,configured,author,manager,skills}
}

test('qualification query budget keeps the ten-skill ceiling and requires every actual current proof',async()=>{
 const {h,author,skills}=await qualificationBudgetFixture(10);try{
  await h.db.exec(await readFile(new URL(qualificationBudgetMigration,root),'utf8'))
  assert.equal((await h.db.query('select jsonb_array_length(skill_file_ids)::int n from hq_private.agent_roster where id=$1',[author])).rows[0].n,10)
  assert.equal((await h.db.query('select hq_private.workforce_agent_qualified($1) ok',[author])).rows[0].ok,true)
  const current=(await h.db.query('select hq_private.workforce_qualification_context($1) context',[author])).rows[0].context
  assert.deepEqual(current.skillFileIds,skills)
  await h.db.query('update hq_private.brain_files set source_version=\'2\' where file_id=$1',[skills[9]])
  assert.equal((await h.db.query('select hq_private.workforce_agent_qualified($1) ok',[author])).rows[0].ok,false)
  assert.equal((await h.db.query('select hq_private.workforce_qualification_context($1) context',[author])).rows[0].context,null)
 }finally{await h.db.close()}
})

test('qualification query budget preserves real per-skill proof and current claim context across a populated roster',async()=>{
 const {h,author,manager,skills}=await qualificationBudgetFixture();try{
  const before=(await h.db.query(`select id,hq_private.workforce_agent_qualified(id) qualified,hq_private.workforce_qualification_context(id) qualification
   from hq_private.agent_roster where enabled order by id`)).rows
  assert.equal(before.length,18);assert.equal(before.filter(a=>a.qualified).length,8)
  const oid=(await h.db.query("select 'hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure::oid oid")).rows[0].oid
  await h.db.exec(await readFile(new URL(qualificationBudgetMigration,root),'utf8'))
  assert.equal((await h.db.query("select 'hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure::oid oid")).rows[0].oid,oid)
  assert.deepEqual((await h.db.query(`select id,hq_private.workforce_agent_qualified(id) qualified,hq_private.workforce_qualification_context(id) qualification
   from hq_private.agent_roster where enabled order by id`)).rows,before)
  for(const [table,id,column,value] of [['hq_private.brain_files','synthetic_research_profile','source_version','2'],
   ['hq_private.brain_files',skills[1],'source_version','2'],['hq_private.brain_files','synthetic_research_profile','in_scope',false],
   ['hq_private.brain_files','synthetic_research_profile','trashed',true],['hq_private.agent_roster',author,'model','gpt-6-luna'],
   ['hq_private.agent_roster',author,'effort','high'],['hq_private.agent_roster',author,'enabled',false],
   ['hq_private.agent_roster',author,'lifecycle','trial pending'],['hq_private.agent_roster',manager,'model_tier','T1_WORKER']]){
   const key=table.endsWith('brain_files')?'file_id':'id'
   const saved=(await h.db.query(`select ${column} as value from ${table} where ${key}=$1`,[id])).rows[0].value
   if(column==='trashed')await h.db.query('update hq_private.brain_files set in_scope=false where file_id=$1',[id])
   await h.db.query(`update ${table} set ${column}=$1 where ${key}=$2`,[value,id])
   assert.equal((await h.db.query('select hq_private.workforce_agent_qualified($1) ok',[author])).rows[0].ok,false,table+'.'+column)
   await h.db.query(`update ${table} set ${column}=$1 where ${key}=$2`,[saved,id])
   if(column==='trashed')await h.db.query('update hq_private.brain_files set in_scope=true where file_id=$1',[id])
  }
  assert.equal((await h.db.query('select hq_private.workforce_agent_qualified($1) ok',[author])).rows[0].ok,true)
  await h.as('founder');await h.rpc('hq_create_task',['Synthetic budget regression','Prepare one internal draft.','Return a bounded draft using current proof.',manager,randomUUID()])
  let j=await h.claim();await h.finish(j,{assigneeId:manager,reason:'Head scopes one internal draft.',message:'@Employee 4 please scope.'})
  j=await h.claim();await h.finish(j,{message:'@Synthetic Research Worker prepare the bounded draft.',delegateId:author})
  j=await h.claim();await h.finish(j,{message:'I will preserve current source and evidence bindings.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.context.assignee.qualified,true)
  assert.deepEqual(j.context.assignee.qualification,before.find(a=>a.id===author).qualification)
  await h.finish(j,'Synthetic bounded draft.')
  j=await h.claim();assert.equal(j.context.mode,'head-review')
  assert.deepEqual(j.context.artifact.authorQualification,j.context.assignee.qualification)
  assert.equal(j.context.artifact.authorQualified,true)
  await h.db.exec('reset role')
  assert.equal((await h.db.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
   lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   where n.nspname='hq_private' and p.proname in ('workforce_skill_evidence_valid','task_evidence_context') and acl.privilege_type='EXECUTE' and acl.grantee<>p.proowner`)).rows[0].n,0)
 }finally{await h.db.close()}
})
test('ordinary repair retains original artifact/job/digest receipts and current subject qualification through actual claims',async()=>{
 const skill='synthetic_evidence_skill',author='AG-RES-099',manager='AG-RES-001',{h,configured}=await trialSetup([skill],true,author,manager);try{
  await installTaskEvidence(h)
  await passSkillTrial(h,skill,author,manager)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id===author?{...a,lifecycle:'Active; bounded drafting only'}:a))])
  await h.as('founder');const snapshot=await h.rpc('hq_create_task',['Synthetic evidence continuity','One internal draft from observed public evidence.','Preserve missing excerpts and original provenance.',manager,randomUUID()])
  const task=snapshot.tasks.find(t=>t.title==='Synthetic evidence continuity')
  let j=await h.claim();assert.equal(j.context.mode,'task-route')
  await h.finish(j,{assigneeId:manager,reason:'Head scopes the one internal draft.',message:'@Employee 4 please scope.'})
  j=await h.claim();assert.equal(j.context.mode,'task-ack')
  await h.finish(j,{message:'@Synthetic Research Worker prepare the bounded draft.',delegateId:author})
  j=await h.claim();assert.equal(j.context.mode,'task-start');await h.finish(j,{message:'I will use only observed sources.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.context.assignee.qualified,true)
  const firstJob=j.id,receipts=[{version:1,eventId:'native_fixture_original',tool:'web_search',action:'search',queries:['synthetic public query'],
    sources:[{url:'https://example.com/observed',title:'Observed fixture',excerpt:'Observed public fixture text.'},{url:'https://example.com/unavailable',title:'No excerpt observed',excerpt:null}],observedAt:'2026-11-08T00:00:00.000Z',truncated:false}]
  await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'Synthetic draft with deliberately insufficient detail.',error:null,evidence:receipts})
  j=await h.claim();assert.equal(j.context.mode,'head-review');assert.equal(j.context.assignee.id,author);assert.equal(j.context.assignee.qualified,true)
  assert.equal(j.context.artifact.agentId,author);assert.equal(j.context.artifact.authorQualified,true);assert.equal(j.context.artifact.jobId,firstJob)
  const original={id:j.context.artifact.id,jobId:firstJob,digest:j.context.artifact.digest}
  assert.deepEqual(j.context.artifact.toolEvidence,receipts)
  assert.ok(j.context.taskDelegations.some(x=>x.kind==='task-route'&&x.assigneeId===manager))
  assert.ok(j.context.taskDelegations.some(x=>x.kind==='task-ack'&&x.agentId===manager&&x.delegateId===author))
  await h.finish(j,{accepted:false,summary:'Remove unsupported details; preserve the original evidence boundaries.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-start');await h.finish(j,{message:'I will repair without claiming fresh research.'})
  j=await h.claim();assert.equal(j.context.mode,'task-work')
  let prior=j.context.task_history.find(x=>x.id===original.id)
  assert.deepEqual({id:prior.id,jobId:prior.jobId,digest:prior.digest},original);assert.deepEqual(prior.toolEvidence,receipts)
  await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'Repaired bounded draft; earlier receipt remains historical and a missing excerpt remains unavailable.',error:null,evidence:[]})
  j=await h.claim();assert.equal(j.context.mode,'head-review');assert.deepEqual(j.context.artifact.toolEvidence,[])
  prior=j.context.task_history.find(x=>x.id===original.id);assert.deepEqual(prior.toolEvidence,receipts);assert.equal(prior.jobId,firstJob)
  assert.equal(j.context.taskHistoryTruncated,false);assert.equal(j.context.taskDelegationsTruncated,false)
  await h.finish(j,{accepted:true,summary:'The repaired artifact respects its evidence limits.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'ceo-review');assert.equal(j.context.artifact.authorQualified,true);assert.equal(j.context.assignee.qualified,true)
  assert.deepEqual(j.context.task_history.find(x=>x.id===original.id).toolEvidence,receipts)
  await h.finish(j,{accepted:true,summary:'Bounded internal acceptance met.',artifactDigest:j.context.artifact.digest})
  j=await h.claim();assert.equal(j.context.mode,'task-report');assert.equal(j.context.task.id,task.id)
  assert.deepEqual(j.context.task_history.find(x=>x.id===original.id).toolEvidence,receipts)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select evidence from hq_private.native_tool_receipts where job_id=$1',[firstJob])).rows[0].evidence[0].eventId,'native_fixture_original')
 }finally{await h.db.close()}
})
test('evidence helper enforces task/founder/conversation boundaries, private ACLs and pre-lease capacity',async()=>{
 const h=await setup(true,true,true,true);try{
  await installTaskEvidence(h)
  await h.as('founder');const snapshot=await h.rpc('hq_create_task',['Synthetic scoped evidence','Bounded internal draft.','No external action.','AG-RES-001',randomUUID()])
  const task=snapshot.tasks.find(x=>x.title==='Synthetic scoped evidence')
  let j=await h.claim();await h.finish(j,{assigneeId:'AG-RES-001',reason:'Research head drafts internally.',message:'@Employee 4 draft.'})
  j=await h.claim();await h.finish(j,{message:'I will draft.',delegateId:null})
  j=await h.claim();assert.equal(j.context.mode,'task-work')
  await h.finish(j,'Observed internal fixture only.')
  j=await h.claim();assert.equal(j.context.mode,'ceo-review')
  await h.db.exec('reset role')
  const row=(await h.db.query('select to_jsonb(j) j from public.hq_agent_jobs j where id=$1',[j.id])).rows[0].j
  const call=async(job,context=j.context)=>(await h.db.query('select hq_private.task_evidence_context(jsonb_populate_record(null::public.hq_agent_jobs,$1::jsonb),$2::jsonb) context',[JSON.stringify(job),JSON.stringify(context)])).rows[0].context
  for(const change of [{founder_user_id:randomUUID()},{conversation_id:randomUUID()},{founder_message_id:randomUUID()}])await assert.rejects(()=>call({...row,...change}),/HQ_TASK_EVIDENCE_SCOPE_INVALID/)
  const skipped={...j.context,mode:'task-route',task_history:null}
  assert.deepEqual(await call({...row,kind:'task-route'},skipped),skipped)
  const mismatchedAuthor={...j.context,artifact:{...j.context.artifact,id:randomUUID()}}
  assert.deepEqual((await call(row,mismatchedAuthor)).artifact,mismatchedAuthor.artifact)
  const tight={...j.context,task_history:[],taskDelegations:[],syntheticRequired:''}
  const baselineBytes=(await h.db.query('select octet_length($1::jsonb::text) n',[JSON.stringify(tight)])).rows[0].n
  tight.syntheticRequired='x'.repeat(245700-baselineBytes)
  const bounded=await call(row,tight)
  assert.equal((await h.db.query('select octet_length($1::jsonb::text)<=245760 ok',[JSON.stringify(bounded)])).rows[0].ok,true)
  assert.ok(bounded.taskHistoryTruncated||bounded.taskDelegationsTruncated,'optional omissions are explicit before lease admission')
  await h.as('worker');await assert.rejects(()=>h.db.query('select hq_private.task_evidence_context(null::public.hq_agent_jobs,$1::jsonb)',['{}']),/permission denied/)
  await h.db.exec('reset role')
  await h.db.exec("create or replace function hq_private.workforce_qualification_context(p_agent_id text) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('syntheticRequired',repeat('x',250000))$$")
  // Release the fixture lease only; the next actual claim must block before allocating a new lease.
  await h.db.query("update public.hq_agent_jobs set status='queued',worker_id=null,lease_token=null,lease_expires_at=null,started_at=null where id=$1",[j.id])
  assert.equal(await h.claim(),null)
  await h.db.exec('reset role')
  const blocked=(await h.db.query('select status,error,lease_token from public.hq_agent_jobs where id=$1',[j.id])).rows[0]
  assert.deepEqual(blocked,{status:'blocked',error:'context-capacity',lease_token:null})
  assert.equal((await h.db.query("select count(*)::int n from public.hq_agent_jobs where task_id=$1 and status='working'",[task.id])).rows[0].n,0)
 }finally{await h.db.close()}
})
test('actual emitted pre-turn failure proof settles durably without qualification or poisoned drain',async()=>{
 const {h}=await trialSetup(['failure_skill_01']);try{
  for(const appServer of [{nullEffort:true},{modelMismatch:true}]){
   const {j,trial}=await claimTrialWork(h,'failure_skill_01')
   let failure
   await fake([],async config=>{try{await invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000))}catch(error){failure=error}},{cliVersion:'codex-cli 0.160.0',appServer})
   assert.equal(codeOf(failure),'provider-model-resolution-invalid')
   assert.equal(failure.modelBindingEvidence.invocation.protocol.turnStart,null)
   assert.equal(failure.modelBindingEvidence.turnsStarted,0)
   const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:codeOf(failure),evidence:[],
     modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}
   const gate=maintenanceGate();let written
   await gate.run(()=>delivery(h,entry,value=>{written=value}))
   assert.equal(written.phase,'delivered');assert.equal(gate.snapshot().uncertain,false)
   const replay=await delivery(h,entry);assert.equal(replay.trialReceiptAccepted,true)
   await h.db.exec('reset role')
   assert.equal((await h.db.query('select status from public.hq_agent_jobs where id=$1',[j.id])).rows[0].status,'blocked')
   assert.equal((await h.db.query('select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).rows[0].n,0)
   assert.equal((await h.db.query('select outcome from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows[0].outcome,'failed')
   await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
   assert.equal(await h.claim(),null)
  }
 }finally{await h.db.close()}
})
test('each current assigned skill requires its own reviewed receipt with the full unchanged binding',async()=>{
 const skills=['assigned_skill_alpha','assigned_skill_beta'],{h,configured}=await trialSetup(skills)
 const active=configured.map(a=>a.id==='AG-HR-002'?{...a,lifecycle:'Active'}:a)
 try{
  await passSkillTrial(h,skills[0])
  await h.as('founder');let row=(await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002')
  assert.equal(row.skillFileId,skills[1]);assert.equal(row.eligible,true);assert.equal(row.receiptIssued,true);assert.equal(row.qualified,false)
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(active)])
  await h.as('founder');assert.equal((await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002').qualified,false,'Active cannot qualify an untested second skill')
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
  await passSkillTrial(h,skills[0])
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(active)])
  await h.as('founder');assert.equal((await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002').qualified,false,'duplicate first-skill receipts cannot cover the second skill')
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
  await passSkillTrial(h,skills[1])
  await h.as('founder');row=(await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002')
  assert.equal(row.skillFileId,null);assert.equal(row.qualified,false,'pending lifecycle remains blocked after complete evidence')
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(active)])
  await h.as('founder');assert.equal((await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002').qualified,true)
  await h.db.exec('reset role')
  assert.deepEqual((await h.db.query("select skill_file_ids from hq_private.agent_roster where id='AG-HR-002'")).rows[0].skill_file_ids,skills)
  await h.db.query("update hq_private.brain_files set source_version='2' where file_id=$1",[skills[1]])
  await h.as('founder');assert.equal((await h.rpc('hq_workforce_trial_status')).find(a=>a.agentId==='AG-HR-002').qualified,false,'any indexed skill revision invalidates the full receipt binding')
 }finally{await h.db.close()}
})


test('authenticated catalog proof works without privileged OpenAPI and exposes no queue or identity data',async()=>{
  const h=await setup(true,false,true,false,true)
  try {
    const status=await h.rpc('hq_worker_release_status',[worker])
    assert.equal(checkApiContract(status),2);assert.deepEqual(status.api.rpcs,REQUIRED_RPCS)
    assert.deepEqual(Object.keys(status).sort(),['activeJobs','api','contract','trialDelivery','trialFailureSettlement','trialSkills'])
    await assert.rejects(()=>h.db.query('select * from public.hq_agent_jobs'),/permission denied/)
    await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_WORKER_REQUIRED/)
    await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_release_status',[randomUUID()]),/HQ_WORKER_REQUIRED/)
    for(const change of [
      `update hq_private.agent_workers set enabled=false where worker_id='${worker}'`,
      `delete from auth.sessions where id='${workerSession}'`,
      `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${workerSession}'`,
      `update auth.users set email_confirmed_at=null where id='${workerUser}'`
    ]) {
      await h.db.exec('reset role;begin;'+change);await h.as('worker')
      await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_WORKER_REQUIRED/)
      await h.db.exec('rollback;reset role')
    }
    for(const role of ['anon','service_role']) {
      await h.db.exec('reset role;set role '+role)
      await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/permission denied/)
    }
  } finally {await h.db.close()}
})
test('catalog proof rejects absent RPCs, renamed arguments, revoked execute or schema usage and wrong return types',async()=>{
  const h=await setup(true,false,true,false,true)
  try {
    await h.db.exec('reset role')
    const definition=(await h.db.query("select pg_get_functiondef('public.hq_worker_claim(uuid,integer,integer)'::regprocedure) body")).rows[0].body
    for(const change of [
      'drop function public.hq_worker_presence(uuid)',
      'revoke execute on function public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from authenticated',
      'revoke usage on schema public from public,authenticated',
      'revoke usage on schema hq_private from authenticated',
      'drop function public.hq_worker_claim(uuid,integer,integer);'+definition.replaceAll('p_meeting_protocol','p_wrong'),
      "drop function public.hq_worker_presence(uuid);create function public.hq_worker_presence(p_worker_id uuid) returns text language sql as $$select 'bad'::text$$;grant execute on function public.hq_worker_presence(uuid) to authenticated"
    ]) {
      await h.db.exec('reset role;begin;'+change);await h.as('worker')
      await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_RELEASE_SCHEMA_INCOMPATIBLE|permission denied/)
      await h.db.exec('rollback;reset role');await h.as('worker')
      assert.equal(checkApiContract(await h.rpc('hq_worker_release_status',[worker])),2)
    }
  } finally {await h.db.close()}
})


test('catalog proof rejects matching overloads including optional extra arguments and preserves unrelated overloads',async()=>{
  const h=await setup(true,false,true,false,true)
  try {
    const statement=params=>`create function public.hq_worker_presence(${params}) returns jsonb language sql as $$select '{}'::jsonb$$;`
    for(const params of ['p_worker_id text',"p_worker_id uuid,p_extra text default ''",
      'p_worker_id text,p_optional text default null','OUT ignored jsonb, IN p_worker_id text',
      'OUT ignored jsonb, IN p_worker_id text, IN p_optional text default null']) {
      await h.db.exec('reset role;begin;'+statement(params));await h.as('worker')
      await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_RELEASE_SCHEMA_INCOMPATIBLE/)
      await h.db.exec('rollback;reset role')
    }
    for(const params of ['p_other_id text','p_worker_id uuid,p_required text','jsonb','OUT ignored jsonb, IN p_other_id text']) {
      await h.db.exec('reset role;begin;'+statement(params));await h.as('worker')
      assert.equal(checkApiContract(await h.rpc('hq_worker_release_status',[worker])),2)
      await h.db.exec('rollback;reset role')
    }
  } finally {await h.db.close()}
})
test('catalog proof requires the fixed invoker wrappers private entry signatures and execute grants',async()=>{
  const h=await setup(true,false,true,false,true)
  try {
    for(const change of [
      'revoke execute on function hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from authenticated',
      'alter function hq_private.worker_presence(uuid) rename to worker_presence_unavailable'
    ]) {
      await h.db.exec('reset role;begin;'+change);await h.as('worker')
      await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_RELEASE_SCHEMA_INCOMPATIBLE/)
      await h.db.exec('rollback;reset role');await h.as('worker')
      assert.equal(checkApiContract(await h.rpc('hq_worker_release_status',[worker])),2)
    }
  } finally {await h.db.close()}
})


async function resumeFixture() {
 const h=await setup()
 await h.db.exec('reset role')
 await h.db.exec(await readFile(new URL('./bootstrap/initial-staging-pause.sql',import.meta.url),'utf8'))
 return h
}
const resumeSource=()=>readFile(new URL('20261107142302_hq_worker_admission_resume.sql',root),'utf8')

test('activation source compare-and-resumes only the exact observed hold without changing auth',async()=>{
 const h=await resumeFixture();try{
  const before=(await h.db.query('select worker_id,auth_user_id,enabled from hq_private.agent_workers')).rows
  await h.db.exec(await resumeSource())
  assert.deepEqual((await h.db.query('select worker_id,auth_user_id,enabled from hq_private.agent_workers')).rows,before)
  await h.as('worker')
  assert.deepEqual(await h.rpc('hq_worker_admission_status',[worker]),{paused:false,generation:2,activeJobs:0})
 }finally{await h.db.close()}
})

test('activation source rejects stale, missing, already resumed or mismatched holds',async()=>{
 for(const mutation of [
  "update hq_private.worker_admission_pauses set generation=2",
  "update hq_private.worker_admission_pauses set paused=false",
  "update hq_private.worker_admission_pauses set request_id=gen_random_uuid()",
  "delete from hq_private.worker_admission_pauses",
 ]){
  const h=await resumeFixture();try{
   await h.db.exec(mutation)
   const before=(await h.db.query('select * from hq_private.worker_admission_pauses')).rows
   const sql=await resumeSource()
   await assert.rejects(()=>h.db.exec(sql),/HQ_ACTIVATION_PAUSE_MISMATCH/)
   await h.db.exec('rollback')
   assert.deepEqual((await h.db.query('select * from hq_private.worker_admission_pauses')).rows,before)
  }finally{await h.db.close()}
 }
})

test('activation source rejects a disabled target or another registered worker without changing either',async()=>{
 for(const mutation of [
  'update hq_private.agent_workers set enabled=false',
  `insert into hq_private.agent_workers(worker_id,auth_user_id,enabled) values('${randomUUID()}','${randomUUID()}',false)`,
 ]){
  const h=await resumeFixture();try{
   await h.db.exec(mutation)
   const before=(await h.db.query('select worker_id,auth_user_id,enabled from hq_private.agent_workers order by worker_id')).rows
   const sql=await resumeSource()
   await assert.rejects(()=>h.db.exec(sql),/HQ_ACTIVATION_WORKER_MISMATCH/)
   await h.db.exec('rollback')
   assert.deepEqual((await h.db.query('select worker_id,auth_user_id,enabled from hq_private.agent_workers order by worker_id')).rows,before)
   assert.equal((await h.db.query('select paused from hq_private.worker_admission_pauses')).rows[0].paused,true)
  }finally{await h.db.close()}
 }
})

test('activation source fails closed when contract capability or model-receipt prerequisites are missing',async()=>{
 for(const mutation of [
  'drop function public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)',
  'drop function hq_private.workforce_skill_evidence_valid(text,text)',
  'drop function public.hq_worker_release_status(uuid)',
  'drop table hq_private.workforce_model_execution_receipts',
 ]){
  const h=await resumeFixture();try{
   await h.db.exec(mutation)
   const sql=await resumeSource()
   await assert.rejects(()=>h.db.exec(sql),/HQ_ACTIVATION_CONTRACT_REQUIRED/)
   await h.db.exec('rollback')
   assert.deepEqual((await h.db.query('select paused,generation from hq_private.worker_admission_pauses')).rows,[{paused:true,generation:1}])
  }finally{await h.db.close()}
 }
})

test('activation source refuses existing working jobs without clearing the hold',async()=>{
 const h=await setup();try{
  await h.as('founder');await h.rpc('hq_create_task',['Activation guard fixture','One internal draft','One draft','AG-HR-002',randomUUID()])
  assert.ok(await h.claim()) // Disposable DB lease only; no model process is invoked.
  await h.db.exec('reset role')
  await h.db.exec(await readFile(new URL('./bootstrap/initial-staging-pause.sql',import.meta.url),'utf8'))
  const sql=await resumeSource()
  await assert.rejects(()=>h.db.exec(sql),/HQ_ACTIVATION_WORK_UNSETTLED/)
  await h.db.exec('rollback')
  assert.deepEqual((await h.db.query('select paused,generation from hq_private.worker_admission_pauses')).rows,[{paused:true,generation:1}])
 }finally{await h.db.close()}
})

async function staffingFixture() {
 const h=await setup(true,true,true,true,true)
 try {

  await h.db.exec('reset role')
  await h.db.exec("update hq_private.brain_files set source_version='1',parent_ids=array['1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'],name=file_id||'.md';")
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
    values('staffing_dev_profile','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['staffing_dev_folder'],'Synthetic profile.md','text/markdown','1',false,true),
    ('staffing_dev_skill','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['staffing_skills_folder'],'Synthetic skill.md','text/markdown','2',false,true),
    ('staffing_model_policy','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'],'Workforce Operating Rules.md','text/markdown','1',false,true)`)
  await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
    values('staffing_departments','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'],'Departments','application/vnd.google-apps.folder','1',false,true),
    ('staffing_dev_folder','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['staffing_departments'],'Development','application/vnd.google-apps.folder','1',false,true),
    ('staffing_skills_folder','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',array['staffing_dev_folder'],'Skills','application/vnd.google-apps.folder','1',false,true)`)
  const pending=[...roster,{id:'AG-DEV-050',name:'Synthetic pending worker',role:'Worker',departmentKey:'development-maintenance',
    profileFileId:'staffing_dev_profile',skillFileIds:['staffing_dev_skill'],lifecycle:'configured trial pending',model:'gpt-6.1-terra',effort:'medium',managerId:'AG-DEV-001',modelTier:'T1_WORKER'}]
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(pending)])
  await h.db.exec('reset role');await h.db.exec(await readFile(new URL('20261107231929_hq_staffing_approval_workflow.sql',root),'utf8'))
  return h
 } catch(error) { await h.db.close(); throw error }
}
const syntheticHirePlan=()=>({agentId:'AG-DEV-099',name:'Synthetic hire',managerId:'AG-DEV-001',profileDraft:'---\nemployee_id: AG-DEV-099\nreports_to: AG-DEV-001\n---\n# Synthetic worker\nInternal bounded drafting only.\n## 5. Assigned skills\n- [[Departments/Development/Skills/Synthetic skill]]\n',
 skills:[{fileId:'staffing_dev_skill',sourceVersion:'2'}],trialCriteria:'Each assigned skill needs actual execution, manager and independent same-artifact review.',resumeOriginal:true})
async function staffingGap(h) {
 await h.as('founder')
 const title='Synthetic gap '+randomUUID().slice(0,8)
 const snapshot=await h.rpc('hq_create_task',[title,'One internal development draft.','Draft only.','AG-DEV-001',randomUUID()])
 const source=snapshot.tasks.find(t=>t.title===title)
 let job=await h.claim();await delivery(h,staffingEntry(job,JSON.stringify({assigneeId:'AG-DEV-001',reason:'The existing head owns this internal request.',message:'@Employee 9 scope the internal draft.'})))
 job=await h.claim();await delivery(h,staffingEntry(job,'','staffing-required'))
 await h.as('worker');return{source,job:(await h.rpc('hq_worker_staffing_claim',[worker])).job}
}
const staffingEntry=(job,reply,error=null)=>({job:{id:job.id,lease_token:job.lease_token},phase:'finished',reply,error,evidence:[]})

test('dedicated Amaya plan → actual worker delivery → Steve review → one founder decision stops at unavailable writer',async()=>{
 const h=await staffingFixture();try{
  await h.as('worker')
  const status=await h.rpc('hq_worker_release_status',[worker]);assert.equal(releasedContract(status),2);checkStaffingContract(status)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_staffing_snapshot'),/HQ_FOUNDER_REQUIRED/)
  await h.as('founder')
  const snapshot=await h.rpc('hq_create_task',['Synthetic staffing gap','One internal development draft.','Draft only.','AG-DEV-001',randomUUID()])
  const source=snapshot.tasks.find(t=>t.title==='Synthetic staffing gap')
  let j=await h.claim();await delivery(h,staffingEntry(j,JSON.stringify({assigneeId:'AG-DEV-001',reason:'Same-department head must scope it.',message:'@Employee 9 scope the internal draft.'})))
  j=await h.claim();assert.equal(j.agent_id,'AG-DEV-001');await delivery(h,staffingEntry(j,'','staffing-required'))
  assert.equal(await h.claim(),null,'old ordinary consumer must not claim dedicated staffing stages')
  await h.as('worker');j=(await h.rpc('hq_worker_staffing_claim',[worker])).job
  assert.equal(j.agent_id,'AG-HR-001');assert.equal(j.context.mode,'staffing-plan');validateJob(j)
  const proposal=syntheticHirePlan()
  const output=await fake([{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(proposal)}},{type:'turn.completed'}],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)))
  assert.equal(validateStaffingProfileDraft(JSON.parse(output.reply),j.context.staffing.departmentKey,await h.rpc('hq_worker_roster_sources',[worker])),true)
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,modelExecutionEvidence:output.modelExecutionEvidence}
  await delivery(h,entry);await delivery(h,entry)
  j=(await h.rpc('hq_worker_staffing_claim',[worker])).job;assert.equal(j.agent_id,'AG-CEO-001');assert.equal(j.context.mode,'staffing-review');validateJob(j)
  const reviewEntry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:JSON.stringify({accepted:true,summary:'Independent check of the exact bounded staffing plan.',artifactDigest:j.context.artifact.digest}),error:null,evidence:[]}
  await delivery(h,reviewEntry)
  await h.as('founder');let staffing=await h.rpc('hq_staffing_snapshot')
  const row=staffing.workflows[0];assert.equal(row.status,'approval-required');assert.equal(row.plan.agentId,proposal.agentId)
  assert.equal(row.plan.modelPolicy.model,'gpt-6.1-terra');assert.equal(row.plan.reviewerId,'AG-HR-003')
  const key=randomUUID(),args=[row.planId,row.digest,'approved',true,key]
  const decision=await h.rpc('hq_decide_staffing_plan',args)
  assert.equal(decision.workflows[0].status,'publication-blocked');assert.equal(decision.workflows[0].blocker,'canonical-writer-setup-required')
  assert.deepEqual(await h.rpc('hq_decide_staffing_plan',args),decision)
  await assert.rejects(()=>h.rpc('hq_decide_staffing_plan',[row.planId,row.digest,'rejected',false,key]),/HQ_REQUEST_KEY_REUSED/)
  await assert.rejects(()=>h.rpc('hq_decide_staffing_plan',[row.planId,row.digest,'approved',true,randomUUID()]),/HQ_STAFFING_DECISION_CONFLICT/)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.agent_roster')).rows[0].n,11)
  assert.equal((await h.db.query('select status from public.hq_business_tasks where id=$1',[source.id])).rows[0].status,'blocked')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.staffing_decisions')).rows[0].n,1)
  await assert.rejects(()=>h.db.exec("update hq_private.staffing_plans set digest=repeat('a',64)"),/IMMUTABLE/)
 }finally{await h.db.close()}
})

test('staffing malformed model JSON settles durably, preserves failed history and never replays inference',async()=>{
 const h=await staffingFixture();try{
  for(const reply of ['[]',String.raw`{"profileDraft":"\u0000"}`,'1e1000000','not JSON']){
   const {job}=await staffingGap(h);assert.equal(job.context.mode,'staffing-plan')
   let invocations=0
   const output=await fake([{type:'item.completed',item:{type:'agent_message',text:reply}},{type:'turn.completed'}],async config=>{invocations++;return invokeCodex({...config,id:worker},job,[],AbortSignal.timeout(5000))})
   const entry=staffingEntry(job,output.reply);let written
   await delivery(h,entry,value=>{written=value});await delivery(h,entry)
   assert.equal(invocations,1);assert.equal(written.phase,'delivered');assert.equal(written.reply,'')
   await h.db.exec('reset role')
   const row=(await h.db.query('select status,error from public.hq_agent_jobs where id=$1',[job.id])).rows[0]
   assert.deepEqual(row,{status:'blocked',error:'staffing-plan-invalid'})
  }
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.staffing_plans')).rows[0].n,0)
  assert.equal((await h.db.query('select count(*)::int n from hq_private.workforce_qualification_receipts')).rows[0].n,0)
 }finally{await h.db.close()}
})

test('staffing input drift and cancellation cannot attach a late result, approve changed scope or retain a working lease',async()=>{
 const h=await staffingFixture();try{
  const cases=[
   {change:async source=>h.db.query("update public.hq_business_tasks set brief='Changed scope' where id=$1",[source.id]),restore:()=>{}},
   {change:async source=>h.db.query('update public.hq_business_tasks set error=null where id=$1',[source.id]),restore:()=>{},expected:'staffing-source-task-unavailable'},
   ...['profile_source_9','profile_source_3','staffing_model_policy','staffing_dev_skill'].map(id=>({
    change:()=>h.db.query("update hq_private.brain_files set source_version='3' where file_id=$1",[id]),
    restore:()=>h.db.query('update hq_private.brain_files set source_version=$1 where file_id=$2',[id==='staffing_dev_skill'?'2':'1',id]),
   })),
  ]
  for(const item of cases){
   const {source,job}=await staffingGap(h);assert.ok(job)
   await h.db.exec('reset role');await item.change(source)
   let delivered;await delivery(h,staffingEntry(job,JSON.stringify(syntheticHirePlan())),value=>{delivered=value})
   assert.equal(delivered.phase,'delivered')
   await h.db.exec('reset role')
   assert.deepEqual((await h.db.query('select status,error from public.hq_agent_jobs where id=$1',[job.id])).rows[0],{status:'blocked',error:item.expected??'staffing-binding-stale'})
   await item.restore()
  }
  const {source,job}=await staffingGap(h)
  await h.as('founder');await h.rpc('hq_cancel_task',[source.id])
  const entry=staffingEntry(job,JSON.stringify(syntheticHirePlan()))
  assert.equal((await delivery(h,entry)).discarded,true);assert.equal((await delivery(h,entry)).discarded,true)
  await h.db.exec('reset role')
  assert.equal((await h.db.query("select count(*)::int n from public.hq_agent_jobs where task_id=$1 and status='working'",[job.context.task.id])).rows[0].n,0)
  assert.equal((await h.db.query('select count(*)::int n from hq_private.staffing_plans')).rows[0].n,0)
 }finally{await h.db.close()}
})

test('staffing proof is separate from the exact released ordinary proof and direct old admissions cannot obtain a new-kind lease',async()=>{
 const h=await staffingFixture();try{
  await h.as('worker');let status=await h.rpc('hq_worker_release_status',[worker]);assert.equal(releasedContract(status),2);checkStaffingContract(status)
  await h.db.exec('reset role');await h.db.exec('revoke execute on function hq_private.worker_staffing_claim(uuid) from authenticated')
  await h.as('worker');status=await h.rpc('hq_worker_release_status',[worker]);assert.equal(releasedContract(status),2)
  assert.throws(()=>checkStaffingContract(status),/schema-incompatible/)
  await h.db.exec('reset role');await h.db.exec('grant execute on function hq_private.worker_staffing_claim(uuid) to authenticated')
  const {job}=await staffingGap(h)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.staffing_claim_fences')).rows[0].n,0)
  // New claims require an exact one-use transaction row, even if a stale
  // selector or an owner fixture attempts a working transition directly.
  await h.db.query("update public.hq_agent_jobs set status='blocked',error='worker-interrupted',completed_at=clock_timestamp() where id=$1",[job.id])
  const syntheticId=randomUUID()
  await h.db.query(`insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,attempt)
    select $1,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,'staffing-plan',task_id,1 from public.hq_agent_jobs where id=$2`,[syntheticId,job.id])
  const result=await h.db.query("update public.hq_agent_jobs set status='working',worker_id=$1,lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '300 seconds',started_at=clock_timestamp() where id=$2 returning id",[worker,syntheticId])
  assert.deepEqual(result.rows,[])
  assert.deepEqual((await h.db.query('select status,lease_token from public.hq_agent_jobs where id=$1',[syntheticId])).rows[0],{status:'queued',lease_token:null})
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_staffing_claim',[worker]),/HQ_WORKER_REQUIRED/)
  await h.as('worker');await assert.rejects(()=>h.db.query('select * from hq_private.staffing_claim_fences'),/permission denied/)
 }finally{await h.db.close()}
})

/** Run the exact released five modules over IPC against the disposable DB.
 * No TCP/WebSocket/provider/model access, real credentials or runtime hotpatch. */
async function releasedRecovery(h,job,phase,reply='') {
 const directory=await mkdtemp(join(tmpdir(),'hq-released-recovery-')),state=join(directory,'state')
 const {mkdir}=await import('node:fs/promises');await mkdir(state,{mode:0o700})
 const baseline='030f66ee127c7a5821745fac7c8f63a1c7631ed4'
 for(const name of ['worker.mjs','maintenance.mjs','departmentWorkflow.mjs','workforceRoster.mjs','brainPublisher.mjs']){
  const result=spawnSync('git',['show',baseline+':tooling/hq-agent-host/'+name],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',maxBuffer:1048576})
  assert.equal(result.status,0,result.stderr);await writeFile(join(directory,name),result.stdout,{mode:0o600})
 }
 const target=join(state,job.id+'.json')
 await writeFile(target,JSON.stringify({version:3,project:'https://dpruoncalmwicrqhqelu.supabase.co',worker_id:worker,
  job:{id:job.id,lease_token:job.lease_token},phase,reply,error:null,evidence:[],modelBindingEvidence:null,modelExecutionEvidence:null}),{mode:0o600})
 await writeFile(join(directory,'recovery.mjs'),`
import {start} from './worker.mjs';
const waiting=new Map();let sequence=0;
process.on('message',m=>{const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.value)}});
const api={access:async()=> 'synthetic-access',onToken(){},stop(){},rpc(name,args){return new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});process.send({id,name,args})})}};
globalThis.WebSocket=class extends EventTarget{static OPEN=1;readyState=1;constructor(){super();setTimeout(()=>this.dispatchEvent(new Event('open')),5)}close(){this.readyState=3}send(raw){const f=JSON.parse(raw);if(f.event==='phx_join')setTimeout(()=>{for(const value of [{topic:f.topic,ref:f.ref,event:'phx_reply',payload:{status:'ok'}},{topic:f.topic,event:'system',payload:{status:'ok',extension:'system',message:'Replication connection established'}}])this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))},5)}};
await start({api,roster:{sync:async()=>({count:11})},brain:async()=>{process.send({forbidden:true});throw Error('inference-must-not-replay')},invoke:async()=>{process.send({forbidden:true});throw Error('inference-must-not-replay')}});
`,{mode:0o600})
 const child=spawn(process.execPath,[join(directory,'recovery.mjs')],{stdio:['ignore','pipe','pipe','ipc'],env:{PATH:process.env.PATH,LANG:'C.UTF-8',
  HQ_SUPABASE_URL:'https://dpruoncalmwicrqhqelu.supabase.co',HQ_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',HQ_WORKER_ID:worker,
  HQ_WORKER_EMAIL:'worker@example.invalid',HQ_WORKER_PASSWORD:'x'.repeat(24),HQ_WORKER_STATE_DIR:state}})
 let output='',errorOutput='',forbidden=0;const calls=[];const requests=new Set()
 child.stdout.on('data',v=>{output+=v});child.stderr.on('data',v=>{errorOutput+=v})
 child.on('message',message=>{if(message.forbidden){forbidden++;return}const request=(async()=>{
  try{
   assert.ok(['hq_worker_presence','hq_worker_claim','hq_worker_finish_v4','hq_worker_release_status'].includes(message.name),message.name)
   calls.push(message.name);await h.as('worker')
   const value=await h.rpc(message.name,Object.values(message.args).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))
   if(child.connected)child.send({id:message.id,value})
  }catch(error){if(child.connected)child.send({id:message.id,error:error.message})}
 })();requests.add(request);void request.finally(()=>requests.delete(request))})
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})))
 try{
  let journal
  for(let count=0;count<200;count++){
   journal=JSON.parse(await readFile(target,'utf8'))
   if(journal.phase==='delivered'&&calls.includes('hq_worker_claim'))break
   if(child.exitCode!==null)break
   await new Promise(done=>setTimeout(done,25))
  }
  assert.equal(journal.phase,'delivered',output+errorOutput)
  child.kill('SIGTERM')
  let deadline
  const result=await Promise.race([exit,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('released-recovery-stop-timeout')),3000)})]).finally(()=>clearTimeout(deadline))
  await Promise.all([...requests]);assert.equal(forbidden,0)
  assert.equal(result.code,0,output+errorOutput)
  assert.equal(journal.reply,'');assert.equal(journal.error,null)
  assert.equal(calls.filter(name=>name==='hq_worker_finish_v4').length,phase==='delivered'?0:1)
  assert.doesNotMatch(output+errorOutput,/inference-must-not-replay/)
  return journal
 }finally{if(child.exitCode===null){child.kill('SIGKILL');await exit}await rm(directory,{recursive:true,force:true})}
}

test('exact released worker recovers finished/started staffing journals through unchanged v4 and skips delivered records',async()=>{
 const h=await staffingFixture();try{
  const {job}=await staffingGap(h)
  await releasedRecovery(h,job,'finished',JSON.stringify(syntheticHirePlan()))
  await h.as('worker');const review=(await h.rpc('hq_worker_staffing_claim',[worker])).job
  assert.equal(review.context.mode,'staffing-review')
  await releasedRecovery(h,review,'started')
  await h.db.exec('reset role')
  assert.deepEqual((await h.db.query('select status,error from public.hq_agent_jobs where id=$1',[review.id])).rows[0],{status:'blocked',error:'worker-interrupted'})
  assert.equal((await h.db.query('select count(*)::int n from hq_private.staffing_plans')).rows[0].n,0)
  await releasedRecovery(h,review,'delivered')
 }finally{await h.db.close()}
})

test('staffing reviewer binding rejects self-review and drift while preserving genuinely reviewed legacy receipts',async()=>{
 const skill='staffing_legacy_skill',{h,configured}=await trialSetup([skill]);try{
  await h.db.exec('reset role');await h.db.exec("update hq_private.brain_files set source_version='1'")
  const legacy=await passSkillTrial(h,skill)
  await h.db.exec('reset role')
  const before=(await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts')).rows
  for(const file of ['20261105171608_hq_office_observations.sql','20261107133124_hq_worker_status_compatibility.sql','20261107231929_hq_staffing_approval_workflow.sql'])await h.db.exec(await readFile(new URL(file,root),'utf8'))
  assert.equal((await h.db.query("select hq_private.workforce_skill_evidence_valid('AG-HR-002',$1) ok",[skill])).rows[0].ok,true)
  await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[legacy.trialId])
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id==='AG-HR-003'?{...a,skillFileIds:[skill]}:a))])
  await h.db.exec('reset role');const count=(await h.db.query('select count(*)::int n from public.hq_business_tasks')).rows[0].n
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_begin_supervised_worker_trial',['AG-HR-003',skill,randomUUID()]),/HQ_TRIAL_REVIEWER_UNAVAILABLE/)
  await h.db.exec('reset role');assert.equal((await h.db.query('select count(*)::int n from public.hq_business_tasks')).rows[0].n,count)
  await h.as('founder');const fresh=await h.rpc('hq_begin_supervised_worker_trial',['AG-HR-002',skill,randomUUID()])
  await h.db.exec('reset role');await h.db.exec("update hq_private.brain_files set source_version='2' where file_id='profile_source_3'")
  assert.equal(await h.claim(),null)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_workforce_qualification',[fresh.trialId]),/HQ_TRIAL_REVIEWER_UNAVAILABLE/)
  await h.db.exec('reset role')
  assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts')).rows,before)
  assert.equal((await h.db.query("select hq_private.workforce_skill_evidence_valid('AG-HR-002',$1) ok",[skill])).rows[0].ok,true)
 }finally{await h.db.close()}
})

test('public discovery canonical migration compiles additively with exact legacy API proof and no seeded authority',async()=>{
 const {h}=await trialSetup(['synthetic_public_skill'],true,'AG-RES-002','AG-RES-001')
 try{
  await installTaskEvidence(h)
  await h.db.exec('reset role');await h.db.exec(await readFile(new URL(publicDiscoveryMigration,root),'utf8'))
  await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
  assert.deepEqual(status.api.rpcs,REQUIRED_RPCS);assert.equal(releasedContract(status),2)
  assert.deepEqual(status.researchApi.rpcs,{hq_worker_research_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
  await assert.rejects(()=>h.rpc('hq_begin_public_research_trial',['synthetic_public_skill',randomUUID()]),/HQ_FOUNDER_REQUIRED/)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_receipts')).rows[0].n,0)
  assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
 }finally{await h.db.close()}
})

async function publicDiscoverySetup() {
 const skill='synthetic_public_skill'
 const {h,configured}=await trialSetup([skill],true,'AG-RES-002','AG-RES-001')
 await installTaskEvidence(h)
 await h.db.exec('reset role');await h.db.exec(await readFile(new URL(publicDiscoveryMigration,root),'utf8'))
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id==='AG-RES-002'?{...a,lifecycle:'Active / Qualified'}:a))])
 const claim=async()=>{await h.as('worker');return(await h.rpc('hq_worker_research_claim',[worker,300,1])).job}
 return {h,skill,claim}
}
async function publicDiscoveryWork(h,skill,claim) {
 await h.as('founder');const trial=await h.rpc('hq_begin_public_research_trial',[skill,randomUUID()])
 assert.equal(await h.claim(),null,'legacy clients cannot lease any new-purpose stage')
 let j=await claim();assert.equal(j.context.mode,'task-route');assert.equal(j.context.supervisedTrial.scope,'public-research-tool-trial-v1');assert.match(j.context.task.brief,/Founder-approved public Research tool exercise/);assert.match(j.context.task.acceptance,/Nadia.*Iris/)
 await h.finish(j,{assigneeId:'AG-RES-001',reason:'Research head scopes the approved tool evaluation.',message:'@Employee 4 supervise.'})
 j=await claim();assert.equal(j.context.mode,'task-ack');assert.ok(j.context.roster.some(a=>a.id==='AG-RES-002'))
 await h.finish(j,{message:'@Synthetic Research Worker complete only the approved tool evaluation.',delegateId:'AG-RES-002'})
 j=await claim();assert.equal(j.context.mode,'trial-start');await h.finish(j,{message:'I will evaluate the fixed public tool and evidence only.'})
 j=await claim();assert.equal(j.context.mode,'worker-trial');assert.equal(j.context.publicDiscoveryPermit.bindingDigest,j.context.supervisedTrial.bindingDigest)
 return {trial,j}
}
async function publicDiscoveryOutput(j,sourceCount=1,appServerOverrides={}) {
 const urls=Array.from({length:sourceCount},(_,index)=>'https://salon'+index+'.example.com/services')
 const text=urls.map((url,index)=>'Title: Synthetic public business '+index+'\nURL: '+url+'\nHighlights:\nGenerated public service evidence only.').join('\n\n')
 const hash=value=>createHash('sha256').update(value).digest('hex')
 const metadata={version:1,kind:'mcp-exa-public-discovery',policyId:'exa-public-business-discovery-v1',observedAt:new Date().toISOString(),rawResultSha256:hash('synthetic upstream fixture'),rawResultBytes:26,
  sourceUrls:urls,literalTextSha256:hash(text),partial:true,wholePageVerified:false}
 const item={type:'mcpToolCall',id:'synthetic_mcp_call',server:'hq_public_discovery',tool:'public_business_discovery',arguments:{},status:'completed',result:{content:[{type:'text',text}],structuredContent:metadata},error:null}
 if(j.context.mode!=='worker-trial'){
  const execItem={...item,type:'mcp_tool_call',result:{content:item.result.content,structured_content:metadata}}
  return fake([{type:'thread.started',thread_id:randomUUID()},{type:'turn.started'},{type:'item.completed',item:execItem},
   {type:'item.completed',item:{type:'agent_message',text:'Generated bounded public research artifact.'}},{type:'turn.completed'}],
   config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)))
 }
 return fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,events:[{method:'item/completed',params:{item}}],turnItems:[item],...appServerOverrides}})
}
test('public discovery real worker output → atomic MCP receipt → Nadia → independent Iris → current qualification',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim)
  const output=await publicDiscoveryOutput(j,3)
  assert.equal(output.evidence[0].sources.length,3)
  assert.equal(output.evidence[0].tool,'mcp');assert.ok(output.modelBindingEvidence.publicDiscoveryPolicy)
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence}
  const delivered=await delivery(h,entry)
  assert.equal(delivered.publicDiscoveryReceiptAccepted,true);assert.equal(delivered.trialReceiptAccepted,true)
  assert.equal((await delivery(h,entry)).publicDiscoveryReceiptAccepted,true,'durable replay is idempotent')
  let review=await claim();assert.equal(review.context.mode,'head-review');assert.equal(review.agent_id,'AG-RES-001')
  assert.equal(review.context.publicDiscoveryEvidence[0].jobId,j.id)
  await h.finish(review,{accepted:true,summary:'Head checked the actual selected skill artifact and original tool excerpt.',artifactDigest:review.context.artifact.digest})
  review=await claim();assert.equal(review.agent_id,'AG-HR-003');await h.finish(review,{accepted:true,summary:'Independent evaluator checked the same artifact and real tool receipt.',artifactDigest:review.context.artifact.digest})
  review=await claim();assert.equal(review.context.mode,'task-report');await h.finish(review,'The bounded public tool evaluation was independently reviewed; no outreach occurred.')
  assert.equal(await claim(),null)
  await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[trial.trialId])
  await h.db.exec('reset role')
  assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,true)
  for(const file of ['synthetic_research_profile',skill]){
   await h.db.exec('begin');await h.db.query("update hq_private.brain_files set source_version='2' where file_id=$1",[file])
   assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
   assert.equal((await delivery(h,entry)).publicDiscoveryReceiptAccepted,true,'lost acknowledgment replay survives later source drift without granting current qualification')
   await h.db.exec('rollback;reset role')
  }
  await h.as('worker');const conflicting=structuredClone(output.modelBindingEvidence);conflicting.workerSourceDigest='f'.repeat(64)
  await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,output.reply,null,JSON.stringify(output.evidence),JSON.stringify(output.modelExecutionEvidence),JSON.stringify(conflicting)]),/HQ_DISCOVERY_DELIVERY_CONFLICT/)
  await h.db.exec('reset role')
  const receipt=(await h.db.query('select * from hq_private.public_discovery_receipts')).rows[0]
  assert.equal(receipt.job_id,j.id);assert.equal(receipt.outcome,'completed');assert.equal(receipt.evidence.tool,'mcp')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.native_tool_receipts where job_id=$1',[j.id])).rows[0].n,0)
  await h.as('founder');await h.rpc('hq_create_task',['Generated public research task','Internal public discovery only. Generated fixture marker profile_source_1.','Use real fixed tool receipt; no outreach.',null,randomUUID()])
  let normal=await claim();assert.equal(normal.context.mode,'task-route');await h.finish(normal,{assigneeId:'AG-RES-001',reason:'Research scopes the public task.',message:'@Employee 4 supervise.'})
  normal=await claim();assert.equal(normal.context.roster.find(a=>a.id==='AG-RES-002').publicDiscoveryQualified,true)
  await delivery(h,{job:{id:normal.id,lease_token:normal.lease_token},phase:'finished',reply:JSON.stringify({message:'@Synthetic Research Worker prepare the bounded evidence packet.',delegateId:'AG-RES-002',publicDiscoveryPolicy:'exa-public-business-discovery-v1'}),error:null,evidence:[],modelBindingEvidence:null,modelExecutionEvidence:null})
  normal=await claim();await h.finish(normal,{message:'I will prepare only the approved internal evidence packet.'})
  assert.equal(await h.claim(),null,'old ordinary clients cannot lease now-MCP-required task-work')
  normal=await claim();assert.equal(normal.context.mode,'task-work');assert.equal(normal.context.publicDiscoveryPermit.agentId,'AG-RES-002')
  const normalOutput=await publicDiscoveryOutput(normal)
  assert.equal((await delivery(h,{job:{id:normal.id,lease_token:normal.lease_token},phase:'finished',reply:normalOutput.reply,error:null,evidence:normalOutput.evidence,
   modelBindingEvidence:null,modelExecutionEvidence:normalOutput.modelExecutionEvidence})).publicDiscoveryReceiptAccepted,true)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.native_tool_receipts where job_id=$1',[normal.id])).rows[0].n,0)

 }finally{await h.db.close()}
})

test('public discovery rejects forged scope, mixed evidence and unsafe host policy atomically before completion',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim),output=await publicDiscoveryOutput(j)
  const finish=async(evidence=output.evidence,proof=output.modelBindingEvidence)=>{
   await h.as('worker');return h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,output.reply,null,JSON.stringify(evidence),JSON.stringify(output.modelExecutionEvidence),JSON.stringify(proof)])
  }
  for(const mutate of [
   e=>{e.jobId=randomUUID()},e=>{e.agentId='AG-HR-002'},e=>{e.bindingDigest='f'.repeat(64)},
   e=>{e.policyId='unapproved'},e=>{e.sources[0].excerpt+='changed'},e=>{e.wholePageVerified=true},
   e=>{e.sources[0].url='https://localhost/private'},e=>{e.sources[0].url='https://example.com/?token=synthetic'},
   e=>{e.session='synthetic-sensitive'},e=>{e.rawResultBytes=32769},e=>{e.sources.push(e.sources[0])},
   e=>{e.sources=Array.from({length:4},(_,index)=>({...e.sources[0],url:'https://salon'+index+'.example.com/'}))},
  ]){
   const evidence=structuredClone(output.evidence);mutate(evidence[0]);await assert.rejects(()=>finish(evidence),/HQ_DISCOVERY_EVIDENCE_INVALID/)
  }
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_finish',[j.id,j.lease_token,worker,output.reply,null]),/HQ_DISCOVERY_ATOMIC_FINISH_REQUIRED/)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_finish_v2',[j.id,j.lease_token,worker,output.reply,null,'[]']),/HQ_DISCOVERY_ATOMIC_FINISH_REQUIRED/)
  await assert.rejects(()=>h.rpc('hq_worker_finish_v3',[j.id,j.lease_token,worker,output.reply,null,'[]',JSON.stringify(output.modelExecutionEvidence)]),/HQ_DISCOVERY_ATOMIC_FINISH_REQUIRED/)
  await assert.rejects(()=>finish([]),/HQ_DISCOVERY_EVIDENCE_REQUIRED/)
  await assert.rejects(()=>finish([...output.evidence,output.evidence[0]]),/HQ_DISCOVERY_EVIDENCE_INVALID/)
  await assert.rejects(()=>finish([...output.evidence,{tool:'web_search'}]),/HQ_DISCOVERY_NATIVE_EVIDENCE_FORBIDDEN/)
  for(const mutate of [
   p=>{p.invocation.protocol.threadStart.params.config.mcp_servers={}},
   p=>{p.invocation.protocol.threadStart.params.config.mcp_servers.hq_public_discovery.env={SECRET:'synthetic'}},
   p=>{p.invocation.protocol.threadStart.params.config.mcp_servers.hq_public_discovery.enabled_tools=['unapproved']},
   p=>{p.publicDiscoveryPolicy.budget='unbounded'},p=>{p.publicDiscoveryPolicy.moduleSha256='wrong'},
  ]){
   const proof=structuredClone(output.modelBindingEvidence);mutate(proof);await assert.rejects(()=>finish(output.evidence,proof),/HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID/)
  }
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select status from public.hq_agent_jobs where id=$1',[j.id])).rows[0].status,'working')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_receipts')).rows[0].n,0)
  assert.equal((await h.db.query('select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).rows[0].n,0)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_research_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
 }finally{await h.db.close()}
})

for(const scenario of ['cli-probe','pre-turn','missing-tool'])test('public discovery '+scenario+' failure settles durably and cannot qualify or replay inference',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim);let failure
  await fake([],async config=>{try{await invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000))}catch(error){failure=error}},
   {cliVersion:'codex-cli 0.160.0',versionProbe:scenario==='cli-probe'?{exitCode:1}:{},appServer:{publicDiscovery:true,...(scenario==='pre-turn'?{nullEffort:true}:{})}})
  assert.equal(codeOf(failure),scenario==='cli-probe'?'provider-cli-version-invalid':scenario==='pre-turn'?'provider-model-resolution-invalid':'provider-mcp-evidence-required');assert.equal(failure.modelBindingEvidence.turnsStarted,scenario==='missing-tool'?1:0)
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:codeOf(failure),evidence:[],
   modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}
  let written;const gate=maintenanceGate();await gate.run(()=>delivery(h,entry,value=>{written=value}))
  assert.equal(written.phase,'delivered');assert.equal(gate.snapshot().uncertain,false)
  assert.equal((await delivery(h,entry)).trialReceiptAccepted,true)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select outcome from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows[0].outcome,'failed')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_receipts')).rows[0].n,0)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_research_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
 }finally{await h.db.close()}
})

test('public discovery repair uses its own no-tool host proof and original same-trial tool artifact lineage',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim),output=await publicDiscoveryOutput(j)
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence}
  await delivery(h,entry)
  let review=await claim();await h.finish(review,{accepted:false,summary:'Repair the artifact interpretation using the original literal tool evidence.',artifactDigest:review.context.artifact.digest})
  review=await claim();assert.equal(review.context.mode,'trial-start');assert.equal(review.context.task.attempt,1)
  await h.finish(review,{message:'I will repair only the interpretation from original evidence.'})
  const repair=await claim();assert.equal(repair.context.mode,'worker-trial');assert.equal(repair.context.task.attempt,1)
  assert.equal(repair.context.publicDiscoveryEvidence[0].jobId,j.id)
  const fixed=await fake([],config=>invokeCodex({...config,id:worker},repair,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0'})
  assert.deepEqual(fixed.evidence,[]);assert.deepEqual(fixed.modelBindingEvidence.invocation.protocol.threadStart.params.config.mcp_servers,{})
  await delivery(h,{job:{id:repair.id,lease_token:repair.lease_token},phase:'finished',reply:fixed.reply,error:null,evidence:[],
   modelBindingEvidence:fixed.modelBindingEvidence,modelExecutionEvidence:fixed.modelExecutionEvidence})
  review=await claim();assert.equal(review.context.mode,'head-review');await h.finish(review,{accepted:true,summary:'Head checked the repaired artifact against original source evidence.',artifactDigest:review.context.artifact.digest})
  review=await claim();assert.equal(review.agent_id,'AG-HR-003');await h.finish(review,{accepted:true,summary:'Independent review accepts the exact repaired artifact.',artifactDigest:review.context.artifact.digest})
  review=await claim();await h.finish(review,'The repaired artifact and its original public-tool provenance were reviewed.')
  assert.equal(await claim(),null)
  await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[trial.trialId])
  await h.db.exec('reset role')
  const artifacts=(await h.db.query('select artifact_id,job_id from hq_private.public_discovery_receipts')).rows
  assert.equal(artifacts.length,1);assert.equal(artifacts[0].job_id,j.id);assert.notEqual(artifacts[0].job_id,repair.id)
  const accepted=(await h.db.query('select artifact_id from hq_private.workforce_trials where id=$1',[trial.trialId])).rows[0].artifact_id
  assert.notEqual(accepted,artifacts[0].artifact_id)
  const valid=()=>h.db.query('select hq_private.public_discovery_trial_source_valid($1,$2) q',[trial.trialId,accepted])
  assert.equal((await valid()).rows[0].q,true)
  assert.equal((await h.db.query('select hq_private.public_discovery_trial_source_valid($1,$2) q',[randomUUID(),accepted])).rows[0].q,false)
  for(const change of [
   "update hq_private.brain_files set source_version='2' where file_id='synthetic_research_profile'",
   "update hq_private.agent_roster set model='gpt-6-luna' where id='AG-RES-002'",
   "update hq_private.workforce_trials set status='failed' where id='"+trial.trialId+"'",
  ]){
   await h.db.exec('begin;'+change)
   // Failed trials can retain truthful original proof, but never qualification.
   if(!change.includes("status='failed'"))assert.equal((await valid()).rows[0].q,false)
   assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
   await h.db.exec('rollback')
  }
 }finally{await h.db.close()}
})

test('public discovery new-purpose enrollment accepts already ordinarily qualified Active pilot without grandfathering tool proof',async()=>{
 const skill='synthetic_existing_research_skill'
 const {h,configured}=await trialSetup([skill],true,'AG-RES-002','AG-RES-001')
 try{
  await passSkillTrial(h,skill,'AG-RES-002','AG-RES-001')
  await installTaskEvidence(h)
  await h.db.exec('reset role');await h.db.exec(await readFile(new URL(publicDiscoveryMigration,root),'utf8'))
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id==='AG-RES-002'?{...a,lifecycle:'Active / Qualified'}:a))])
  await h.db.exec('reset role')
  assert.equal((await h.db.query("select hq_private.workforce_agent_qualified('AG-RES-002') q")).rows[0].q,true)
  assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
  await h.as('founder');const key=randomUUID(),trial=await h.rpc('hq_begin_public_research_trial',[skill,key])
  assert.equal((await h.rpc('hq_begin_public_research_trial',[skill,key])).trialId,trial.trialId)
  await assert.rejects(()=>h.rpc('hq_begin_public_research_trial',['different_skill',key]),/HQ_TRIAL_REQUEST_KEY_REUSED/)
  await assert.rejects(()=>h.rpc('hq_begin_public_research_trial',[null,key]),/HQ_TRIAL_NOT_ELIGIBLE/)
  await assert.rejects(()=>h.rpc('hq_issue_public_research_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_receipts')).rows[0].n,0)
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_claim_requests')).rows[0].n,0)
 }finally{await h.db.close()}
})

test('public discovery cached legacy claim is fenced, ordinary chat remains usable, and new API grants fail closed',async()=>{
 const skill='synthetic_claim_fence_skill',{h}=await trialSetup([skill],true,'AG-RES-002','AG-RES-001')
 try{
  await installTaskEvidence(h);await h.db.exec('reset role')
  const old=(await h.db.query("select pg_get_functiondef('hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure) d")).rows[0].d
  const copied=old.replace('FUNCTION hq_private.worker_claim_before_meetings(', 'FUNCTION hq_private.cached_legacy_discovery_fixture(')
  assert.notEqual(copied,old);await h.db.exec(copied+'; grant execute on function hq_private.cached_legacy_discovery_fixture(uuid,integer) to authenticated')
  await h.db.exec(await readFile(new URL(publicDiscoveryMigration,root),'utf8'))
  await h.as('founder');const trial=await h.rpc('hq_begin_public_research_trial',[skill,randomUUID()])
  await assert.rejects(()=>h.rpc('hq_worker_research_claim',[worker,300,1]),/HQ_WORKER_REQUIRED/)
  await h.as('worker');await assert.rejects(()=>h.db.query('select hq_private.cached_legacy_discovery_fixture($1,300)',[worker]),/HQ_DISCOVERY_CLIENT_REQUIRED/)
  assert.equal(await h.claim(),null)
  await h.db.exec('reset role')
  assert.equal((await h.db.query("select count(*)::int n from public.hq_agent_jobs where task_id=$1 and (worker_id is not null or lease_token is not null or status<>'queued')",[trial.taskId])).rows[0].n,0)
  await h.as('founder');await h.rpc('hq_send_ceo_message',['Generated ordinary conversation only.',randomUUID()])
  const ordinary=await h.claim();assert.equal(ordinary.context.mode,'conversation-intake');assert.equal(ordinary.context.publicDiscoveryPermit,undefined)
  await h.db.exec('reset role')
  for(const change of [
   'revoke execute on function public.hq_worker_research_claim(uuid,integer,integer) from authenticated',
   'revoke execute on function hq_private.worker_research_claim(uuid,integer,integer) from authenticated',
   'create function public.hq_worker_research_claim(p_worker_id text,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb language sql as $$select null::jsonb$$',
  ]){
   await h.db.exec('begin;'+change);await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
   assert.deepEqual(status.api.rpcs,REQUIRED_RPCS);assert.equal(status.researchApi,null)
   await h.db.exec('rollback;reset role')
  }
  await h.db.exec('set role anon');await assert.rejects(()=>h.rpc('hq_worker_research_claim',[worker,300,1]),/permission denied/)
 }finally{await h.db.close()}
})

test('public discovery cancellation discards work and retains blocked tool observation without qualification',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim),output=await publicDiscoveryOutput(j)
  await h.as('founder');await h.rpc('hq_cancel_task',[trial.taskId])
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence}
  const result=await delivery(h,entry);assert.equal(result.discarded,true);assert.equal(result.publicDiscoveryReceiptAccepted,true)
  assert.equal((await delivery(h,entry)).discarded,true)
  await h.db.exec('reset role')
  const receipt=(await h.db.query('select artifact_id,outcome from hq_private.public_discovery_receipts where job_id=$1',[j.id])).rows[0]
  assert.equal(receipt.artifact_id,null);assert.equal(receipt.outcome,'blocked')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows[0].n,0)
  assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
  assert.equal((await h.db.query('select status from public.hq_business_tasks where id=$1',[trial.taskId])).rows[0].status,'canceled')
 }finally{await h.db.close()}
})

test('public discovery successful MCP evidence survives later failed AppServer turn into durable blocked receipt only',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  const {trial,j}=await publicDiscoveryWork(h,skill,claim);let failure
  try{await publicDiscoveryOutput(j,1,{turnStatus:'failed'})}catch(error){failure=error}
  assert.ok(failure);assert.equal(failure.modelBindingEvidence.outcome,'failed')
  const evidence=failedToolEvidence(failure)
  assert.equal(evidence.length,1);assert.equal(evidence[0].tool,'mcp');assert.equal(evidence[0].jobId,j.id)
  const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:codeOf(failure),evidence,
   modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}
  let written;const result=await delivery(h,entry,value=>{written=value})
  assert.equal(result.publicDiscoveryReceiptAccepted,true);assert.equal(result.trialReceiptAccepted,true)
  assert.equal(written.phase,'delivered');assert.deepEqual(written.evidence,[])
  assert.equal((await delivery(h,entry)).publicDiscoveryReceiptAccepted,true)
  await h.db.exec('reset role')
  const receipt=(await h.db.query('select outcome,artifact_id,evidence from hq_private.public_discovery_receipts where job_id=$1',[j.id])).rows[0]
  assert.equal(receipt.outcome,'blocked');assert.equal(receipt.artifact_id,null)
  assert.equal(receipt.evidence.rawResultSha256,evidence[0].rawResultSha256)
  assert.equal((await h.db.query('select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).rows[0].n,0)
  assert.equal((await h.db.query('select outcome from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows[0].outcome,'failed')
  assert.equal((await h.db.query('select status from public.hq_agent_jobs where id=$1',[j.id])).rows[0].status,'blocked')
  assert.equal((await h.db.query('select status from hq_private.workforce_trials where id=$1',[trial.trialId])).rows[0].status,'failed')
  assert.equal((await h.db.query("select hq_private.public_discovery_qualified('AG-RES-002') q")).rows[0].q,false)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_research_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
 }finally{await h.db.close()}
})

async function qualifyDiscoveryForScope(h,skill,claim) {
 const {trial,j}=await publicDiscoveryWork(h,skill,claim),output=await publicDiscoveryOutput(j)
 await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
  modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence})
 let review=await claim();await h.finish(review,{accepted:true,summary:'Head checked generated scope fixture evidence.',artifactDigest:review.context.artifact.digest})
 review=await claim();await h.finish(review,{accepted:true,summary:'Independent evaluator checked the same fixture artifact.',artifactDigest:review.context.artifact.digest})
 review=await claim();await h.finish(review,'The generated public tool scope exercise was independently reviewed.')
 assert.equal(await claim(),null);await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[trial.trialId])
}

const researchStatusMigration='20261108180216_hq_public_research_trial_status.sql'
async function installResearchStatus(h) {
 await h.db.exec('reset role')
 await h.db.exec(await readFile(new URL(researchStatusMigration,root),'utf8'))
}
async function researchStatus(h) {
 await h.as('founder')
 return (await h.rpc('hq_workforce_trial_status')).find(row=>row.agentId==='AG-RES-002').publicResearch
}
test('public research status preserves legacy rows and founder authorization, and distinguishes ordinary qualification',async()=>{
 const skill='synthetic_existing_research_skill'
 const {h,configured}=await trialSetup([skill],true,'AG-RES-002','AG-RES-001')
 try{
  await passSkillTrial(h,skill,'AG-RES-002','AG-RES-001')
  await installTaskEvidence(h);await h.db.exec('reset role');await h.db.exec(await readFile(new URL(publicDiscoveryMigration,root),'utf8'))
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured.map(a=>a.id==='AG-RES-002'?{...a,lifecycle:'Active / Qualified'}:a))])
  await h.as('founder');const before=await h.rpc('hq_workforce_trial_status')
  await installResearchStatus(h);await h.as('founder');const after=await h.rpc('hq_workforce_trial_status')
  assert.deepEqual(after.map(row=>{const ordinary={...row};delete ordinary.publicResearch;return ordinary}),before)
  assert.equal(after.filter(row=>'publicResearch' in row).length,1)
  assert.deepEqual(await researchStatus(h),{skillFileId:skill,eligible:true,qualified:false,trialId:null,status:null,
   receiptIssued:false,reviewComplete:false,bindingCurrent:false,taskId:null})
  await h.db.exec("reset role;begin;update hq_private.workforce_trials set status='active' where agent_id='AG-RES-002'")
  assert.equal((await researchStatus(h)).eligible,false,'an active ordinary trial also blocks a new tool trial')
  await h.db.exec('rollback;reset role')
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_workforce_trial_status'),/HQ_FOUNDER_REQUIRED/)
  await assert.rejects(()=>h.db.query('select hq_private.workforce_trial_status_before_public_research()'),/permission denied/)
  await h.db.exec('reset role;set role anon');await assert.rejects(()=>h.rpc('hq_workforce_trial_status'),/permission denied|HQ_FOUNDER_REQUIRED/)
  await h.as('founder');await h.db.exec('reset role')
  await h.db.query('delete from auth.sessions where id=$1',[session]);await h.as('founder')
  await assert.rejects(()=>h.rpc('hq_workforce_trial_status'),/HQ_FOUNDER_REQUIRED/)
 }finally{await h.db.close()}
})
test('public research status follows actual active, independently reviewed, qualified and stale binding states',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  await installResearchStatus(h)
  assert.equal((await researchStatus(h)).eligible,true)
  const {trial,j}=await publicDiscoveryWork(h,skill,claim)
  let status=await researchStatus(h)
  assert.equal(status.status,'active');assert.equal(status.trialId,trial.trialId);assert.equal(status.taskId,trial.taskId)
  assert.equal(status.eligible,false);assert.equal(status.bindingCurrent,true);assert.equal(status.reviewComplete,false)
  const output=await publicDiscoveryOutput(j)
  await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence})
  let review=await claim();await h.finish(review,{accepted:true,summary:'Head checked generated real-path fixture.',artifactDigest:review.context.artifact.digest})
  assert.equal((await researchStatus(h)).reviewComplete,false,'head approval alone is insufficient')
  review=await claim();await h.finish(review,{accepted:true,summary:'Independent evaluator checked same artifact.',artifactDigest:review.context.artifact.digest})
  assert.equal((await researchStatus(h)).reviewComplete,false,'independent review without report is insufficient')
  review=await claim();await h.finish(review,'Generated bounded evaluation report.')
  status=await researchStatus(h)
  assert.equal(status.status,'passed');assert.equal(status.reviewComplete,true);assert.equal(status.qualified,false);assert.equal(status.receiptIssued,false)
  await h.db.exec('reset role;begin');await h.db.query("update hq_private.brain_files set source_version='2' where file_id='profile_source_3'")
  status=await researchStatus(h);assert.equal(status.bindingCurrent,false);assert.equal(status.reviewComplete,false)
  await h.db.exec('rollback;reset role')
  await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[trial.trialId])
  status=await researchStatus(h);assert.equal(status.qualified,true);assert.equal(status.receiptIssued,true);assert.equal(status.eligible,false)
  await h.db.exec('reset role');await h.db.query("update hq_private.brain_files set source_version='2' where file_id=$1",[skill])
  status=await researchStatus(h);assert.equal(status.bindingCurrent,false);assert.equal(status.reviewComplete,false);assert.equal(status.qualified,false)
  assert.equal(status.receiptIssued,true,'historical receipt remains visible without current qualification')
 }finally{await h.db.close()}
})
test('public research status exposes failure without qualification and blocks missing canonical setup',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  await installResearchStatus(h)
  for(const update of ["update hq_private.brain_files set source_version=null where file_id='synthetic_research_profile'",
   "update hq_private.brain_files set trashed=true,in_scope=false where file_id='synthetic_public_skill'",
   "update hq_private.agent_roster set enabled=false where id='AG-RES-001'",
   "update hq_private.agent_roster set lifecycle='paused' where id='AG-RES-001'",
   "update hq_private.agent_roster set enabled=false where id='AG-HR-003'",
   "update hq_private.agent_roster set lifecycle='paused' where id='AG-HR-003'",
   "update hq_private.brain_files set in_scope=false where file_id='profile_source_3'",
   "update hq_private.agent_roster set lifecycle='paused' where id='AG-RES-002'"]){
   await h.db.exec('reset role;begin');await h.db.exec(update);assert.equal((await researchStatus(h)).eligible,false)
   await h.db.exec('rollback;reset role')
  }
  const {j}=await publicDiscoveryWork(h,skill,claim);let failure
  await fake([],async config=>{try{await invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000))}catch(error){failure=error}},
   {cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,nullEffort:true}})
  await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:codeOf(failure),evidence:[],
   modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence})
  const status=await researchStatus(h)
  assert.equal(status.status,'failed');assert.equal(status.reviewComplete,false);assert.equal(status.receiptIssued,false);assert.equal(status.qualified,false)
  await h.as('founder');const canceled=await h.rpc('hq_begin_public_research_trial',[skill,randomUUID()])
  await h.rpc('hq_cancel_task',[canceled.taskId])
  const afterCancel=await researchStatus(h)
  assert.equal(afterCancel.trialId,canceled.trialId);assert.equal(afterCancel.status,'canceled');assert.equal(afterCancel.reviewComplete,false)
 }finally{await h.db.close()}
})
async function originalDiscoveryAck(h,claim,chat=false) {
 const brief='Supplied-context drafting fixture; marker profile_source_1. Do not perform public discovery unless explicitly scoped.'
 await h.as('founder')
 if(chat)await h.rpc('hq_send_ceo_message',['Generated internal task intake.',randomUUID()])
 else await h.rpc('hq_create_task',['Generated task-scope fixture',brief,'Return a bounded internal draft only.',null,randomUUID()])
 let j=await claim()
 if(chat){assert.equal(j.context.mode,'conversation-intake');await h.finish(j,{message:'@Employee 4 scope the bounded internal request.',task:{title:'Generated Chat task',brief,acceptance:'Return a bounded internal draft only.',assigneeId:'AG-RES-001'}})}
 else {assert.equal(j.context.mode,'task-route');await h.finish(j,{assigneeId:'AG-RES-001',reason:'Research scopes the internal task.',message:'@Employee 4 scope.'})}
 j=await claim();assert.equal(j.context.mode,'task-ack');assert.equal(j.context.task.attempt,0)
 assert.equal(j.context.roster.find(a=>a.id==='AG-RES-002').publicDiscoveryQualified,true)
 return j
}
const discoverySelection={message:'@Synthetic Research Worker perform the fixed public discovery needed for this task.',delegateId:'AG-RES-002',publicDiscoveryPolicy:'exa-public-business-discovery-v1'}
const selectionEntry=(j,body=discoverySelection)=>({job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:JSON.stringify(body),error:null,evidence:[],modelBindingEvidence:null,modelExecutionEvidence:null})

test('public discovery task scope is explicit: absent selection preserves ordinary old/new claims, while selected scope is immutable and repair cannot opt in',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  await qualifyDiscoveryForScope(h,skill,claim)
  for(const useOld of [true,false]){
   const ack=await originalDiscoveryAck(h,claim,useOld)
   await h.finish(ack,{message:'@Synthetic Research Worker draft from supplied context only.',delegateId:'AG-RES-002'})
   let j=await h.claim();assert.equal(j.context.mode,'task-start');assert.equal(j.context.publicDiscoveryPermit,undefined)
   await h.finish(j,{message:'I will draft from supplied context only.'})
   j=await(useOld?h.claim():claim());assert.equal(j.context.mode,'task-work');assert.equal(j.context.publicDiscoveryPermit,undefined)
   assert.equal(workerExecutionBlock(j),null);assert.equal(webAllowed(j),true,'existing native capability remains unchanged; no MCP requirement is inferred')
   const output=await fake([{type:'thread.started',thread_id:randomUUID()},{type:'turn.started'},
    {type:'item.completed',item:{type:'agent_message',text:'Generated supplied-context-only draft.'}},{type:'turn.completed'}],
    config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)))
   assert.deepEqual(output.evidence,[])
   await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:[],modelBindingEvidence:null,modelExecutionEvidence:output.modelExecutionEvidence})
   await h.db.exec('reset role');assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_tasks where task_id=$1',[ack.context.task.id])).rows[0].n,0)
   await h.as('founder');await h.rpc('hq_cancel_task',[ack.context.task.id])
  }
  const ack=await originalDiscoveryAck(h,claim,true),entry=selectionEntry(ack)
  const accepted=await delivery(h,entry);assert.equal(accepted.publicDiscoveryPolicyAccepted,true)
  await h.db.exec('reset role')
  const policy=(await h.db.query('select * from hq_private.public_discovery_tasks where task_id=$1',[ack.context.task.id])).rows[0]
  assert.equal(policy.agent_id,'AG-RES-002');assert.equal(policy.trial_id,null)
  assert.equal((await h.db.query('select count(*)::int n from public.hq_agent_jobs where depends_on=$1 and kind=$2',[ack.id,'task-start'])).rows[0].n,1)
  await h.db.exec('begin');await h.db.query("update hq_private.brain_files set source_version='2' where file_id='synthetic_research_profile'")
  assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,true,'lost ACK confirms existing selection without reauthorizing after drift')
  assert.equal(await claim(),null,'fresh work remains blocked by current qualification drift')
  await h.db.exec('rollback;reset role')
  await assert.rejects(()=>h.db.query('update hq_private.public_discovery_tasks set binding_digest=$1 where task_id=$2',['f'.repeat(64),ack.context.task.id]),/immutable/i)
  assert.equal(await h.claim(),null,'legacy clients cannot lease an explicitly enrolled child')
  let j=await claim();assert.equal(j.context.mode,'task-start');await h.finish(j,{message:'I will perform only the selected discovery.'})
  j=await claim();assert.equal(j.context.publicDiscoveryPermit.policyId,'exa-public-business-discovery-v1')
  const output=await publicDiscoveryOutput(j)
  await delivery(h,{job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
   modelBindingEvidence:null,modelExecutionEvidence:output.modelExecutionEvidence})
  let review=await claim();assert.equal(review.agent_id,'AG-RES-001');await h.finish(review,{accepted:true,summary:'Head checked the original bounded source evidence.',artifactDigest:review.context.artifact.digest})
  review=await claim();assert.equal(review.agent_id,'AG-CEO-001');await h.finish(review,{accepted:false,summary:'Repair the interpretation only; no further retrieval.',artifactDigest:review.context.artifact.digest})
  const repair=await claim();assert.equal(repair.context.mode,'task-ack');assert.equal(repair.context.task.attempt,1)
  assert.equal(repair.context.roster.find(a=>a.id==='AG-RES-002')?.publicDiscoveryQualified,undefined)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[repair.id,repair.lease_token,worker,JSON.stringify(discoverySelection),null,'[]',null,null]),/HQ_DISCOVERY_SELECTION_INVALID/)
  await h.db.exec('reset role');assert.equal((await h.db.query('select binding_digest from hq_private.public_discovery_tasks where task_id=$1',[ack.context.task.id])).rows[0].binding_digest,policy.binding_digest)
 }finally{await h.db.close()}
})

test('public discovery selection rejects hostile ACK fields atomically, and stale selection settles blocked without ordinary downgrade',async()=>{
 const {h,skill,claim}=await publicDiscoverySetup()
 try{
  await qualifyDiscoveryForScope(h,skill,claim)
  const ack=await originalDiscoveryAck(h,claim),entry=selectionEntry(ack)
  const finish=async body=>{await h.as('worker');return h.rpc('hq_worker_finish_v4',[ack.id,ack.lease_token,worker,JSON.stringify(body),null,'[]',null,null])}
  for(const mutate of [body=>{body.publicDiscoveryPolicy=null},body=>{body.publicDiscoveryPolicy='unknown-policy'},body=>{body.delegateId='AG-HR-002'},body=>{body.newPermission=true}]){
   const body=structuredClone(discoverySelection);mutate(body);await assert.rejects(()=>finish(body),/HQ_DISCOVERY_SELECTION_INVALID/)
  }
  for(const change of ["agent_id='AG-HR-001'",'attempt=1']){
   await h.db.exec('reset role;begin');await h.db.query('update public.hq_agent_jobs set '+change+' where id=$1',[ack.id])
   await assert.rejects(()=>finish(discoverySelection),/HQ_DISCOVERY_SELECTION_INVALID/)
   await h.db.exec('rollback;reset role')
  }
  for(const endpoint of ['hq_worker_finish','hq_worker_finish_v2','hq_worker_finish_v3']){
   await h.as('worker');const args=[ack.id,ack.lease_token,worker,entry.reply,null,...(endpoint==='hq_worker_finish'?[]:['[]']),...(endpoint==='hq_worker_finish_v3'?[null]:[])]
   await assert.rejects(()=>h.rpc(endpoint,args),/HQ_DISCOVERY_ATOMIC_FINISH_REQUIRED/)
  }
  await h.db.exec('reset role')
  assert.equal((await h.db.query('select status from public.hq_agent_jobs where id=$1',[ack.id])).rows[0].status,'working')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_tasks where task_id=$1',[ack.context.task.id])).rows[0].n,0)
  await h.db.exec("begin;update hq_private.agent_roster set lifecycle='paused' where id='AG-RES-001'")
  assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,false,'a revoked head cannot authorize fresh tool scope')
  assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,false)
  await h.db.exec('rollback;reset role')
  await h.db.query("update hq_private.brain_files set source_version='2' where file_id='synthetic_research_profile'")
  const result=await delivery(h,entry);assert.equal(result.publicDiscoveryPolicyAccepted,false)
  assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,false,'stale finished journal remains idempotently settled')
  await h.db.exec('reset role')
  const row=(await h.db.query('select status,error from public.hq_business_tasks where id=$1',[ack.context.task.id])).rows[0]
  assert.equal(row.status,'blocked');assert.equal(row.error,'public-discovery-binding-stale')
  assert.equal((await h.db.query('select count(*)::int n from hq_private.public_discovery_tasks where task_id=$1',[ack.context.task.id])).rows[0].n,0)
  assert.equal((await h.db.query("select count(*)::int n from public.hq_agent_jobs where task_id=$1 and kind in ('task-start','task-work')",[ack.context.task.id])).rows[0].n,0)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[ack.id,ack.lease_token,worker,entry.reply.replace('this task','another task'),null,'[]',null,null]),/HQ_DISCOVERY_DELIVERY_CONFLICT/)
 }finally{await h.db.close()}
})
