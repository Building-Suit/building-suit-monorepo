/** Disposable PostgreSQL engine checks. No hosted writes or inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { workerExecutionBlock } from './departmentWorkflow.mjs'
import { validateJob, webAllowed } from './worker.mjs'
const require = createRequire(new URL('../../apps/company-hq/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
const root = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
const founder = randomUUID(), workerUser = randomUUID(), worker = randomUUID(), session = randomUUID(), workerSession = randomUUID()
const commonIds = ['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz','1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N']
const ids = ['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001']
const tiers = new Map(ids.map((id,index)=>[id,index===0?'T3_EXEC':[1,4,5,6,7,8,9].includes(index)?'T2_HEAD':'T1_WORKER']))
const departments = new Map(ids.map((id,index)=>[id,index===0?null:index===4?'research-market-intelligence':index===5?'customer-acquisition-partnerships':index===6?'customer-success-onboarding':index===7?'social-community':index===8?'email-lifecycle':index===9?'development-maintenance':'hr-agent-development']))
const managers = new Map(ids.map((id,index)=>[id,index===0?null:[2,3].includes(index)?'AG-HR-001':'AG-CEO-001']))
const roster = ids.map((id,index)=>({id,name:'Employee '+index,role:'Fixture',departmentKey:departments.get(id),profileFileId:'profile_source_'+index,skillFileIds:[],lifecycle:'configured trial pending',model:'gpt-6.1-sol',effort:'medium',managerId:managers.get(id),modelTier:tiers.get(id)}))
async function setup(withEvidence = true, withChat = false, withPresence = true) {
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
  if (withPresence) await db.exec(await readFile(new URL('20261105235516_hq_voice_meetings.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261106000000_hq_department_staffing_needs.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261106010000_hq_department_orchestration_contract.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261106020000_hq_supervised_worker_trials.sql',root),'utf8'))
  await db.exec(await readFile(new URL('20261106030000_hq_qualified_research_web_search.sql',root),'utf8'))
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
    let j=await h.claim();assert.equal(j.context.mode,'task-work');assert.equal(j.agent_id,'AG-HR-002');assert.equal(j.context.agent.model,'gpt-6.1-sol')
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
  const rania={id:'AG-SOC-002',name:'Rania',role:'Social Worker',departmentKey:'social-community',profileFileId:profile,skillFileIds:[skill],lifecycle:'Active',model:'gpt-6-luna',effort:'medium',managerId:'AG-SOC-001',modelTier:'T1_WORKER'}
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
    configuredModel:'gpt-6.1-sol',launchModel:'gpt-6.1-sol',configuredEffort:'medium',launchEffort:'medium',
    settingObservationSource:'explicit-codex-app-server-thread-start-and-locked-config',invocationStatus:'launched',threadId:randomUUID(),laterModelOverrideCount:0,turnsStarted:1,turnsCompleted:1,
    hostResolution:{source:'codex-app-server-thread-start',model:'gpt-6.1-sol',modelProvider:'openai',reasoningEffort:'medium',threadId:'',laterModelOverrideCount:0},
    invocation:{executable:'/opt/codex/bin/codex',argv:['app-server','--stdio','--strict-config','--disable','shell_tool','--disable','shell_snapshot',
        '-c','approval_policy="never"','-c','model_provider="openai"','-c','web_search="disabled"','-c','model_reasoning_effort="medium"','-c','mcp_servers={}'],
      environment:{HOME:'/home/worker',PATH:'/usr/bin',LANG:'C.UTF-8',TERM:'dumb',CODEX_HOME:'/home/worker/.codex'},stdinSha256:'c'.repeat(64),
      protocol:{initialize:{method:'initialize',id:1},threadStart:{method:'thread/start',id:2,params:{model:'gpt-6.1-sol',modelProvider:'openai',cwd:'/tmp/hq-agent-test',
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
