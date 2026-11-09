/** Generated synthetic PostgreSQL + actual worker/CLI contract. No hosted calls. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { fake } from './test-cli.mjs'
import { deliverWorkerEntry, invokeCodex } from './worker.mjs'
import { REQUIRED_RPCS } from './maintenance.mjs'

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

const delivery=(h,entry,write=async()=>{})=>deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write,rpc:async(name,input)=>{
 await h.as('worker');return h.rpc(name,Object.values(input).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))
}},entry)

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


async function publicDiscoveryOutput(j,sourceCount=1,appServerOverrides={}) {
 const retail=j.context.publicDiscoveryPermit?.policyId==='exa-public-retail-discovery-v1'
 const urls=Array.from({length:sourceCount},(_,index)=>'https://salon'+index+'.example.com/services')
 const text=urls.map((url,index)=>'Title: Synthetic public business '+index+'\nURL: '+url+'\nHighlights:\nGenerated public service evidence only.').join('\n\n')
 const hash=value=>createHash('sha256').update(value).digest('hex')
 const metadata={version:1,kind:'mcp-exa-public-discovery',policyId:retail?'exa-public-retail-discovery-v1':'exa-public-business-discovery-v1',...(retail?{category:j.context.publicDiscoveryPermit.category}:{}),observedAt:new Date().toISOString(),rawResultSha256:hash('synthetic upstream fixture'),rawResultBytes:26,
  sourceUrls:urls,literalTextSha256:hash(text),partial:true,wholePageVerified:false}
 const item={type:'mcpToolCall',id:'synthetic_mcp_call',server:'hq_public_discovery',tool:'public_business_discovery',arguments:{},status:'completed',result:{content:[{type:'text',text}],structuredContent:metadata},error:null}
 if(j.context.mode!=='worker-trial'){
  const execItem={...item,type:'mcp_tool_call',result:{content:item.result.content,structured_content:metadata}}
  return fake([{type:'thread.started',thread_id:randomUUID()},{type:'turn.started'},{type:'item.completed',item:execItem},
   {type:'item.completed',item:{type:'agent_message',text:'Generated bounded public research artifact.'}},{type:'turn.completed'}],
   config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)))
 }
 return fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,...(retail?{publicDiscoveryCategory:j.context.publicDiscoveryPermit.category}:{}),events:[{method:'item/completed',params:{item}}],turnItems:[item],...appServerOverrides}})
}

const retailMigration='20261108200632_hq_public_retail_discovery.sql'
async function retailFixture(withRetail=true) {
 const skill='synthetic_retail_skill'
 const {h,configured}=await trialSetup([skill],true,'AG-RES-002','AG-RES-001')
 await installTaskEvidence(h)
 await h.db.exec('reset role')
 for(const file of [publicDiscoveryMigration,'20261108180216_hq_public_research_trial_status.sql','20261108200149_hq_evaluator_qualification_status.sql',...(withRetail?[retailMigration]:[])])
  await h.db.exec(await readFile(new URL(file,root),'utf8'))
 const claim=async()=>{await h.as('worker');return(await h.rpc('hq_worker_role_claim',[worker,300,1])).job}
 return {h,configured,skill,claim,retailInstalled:withRetail}
}
test('retail migration preserves old API and salon status, starts with no authority and no canonical setup',async()=>{
 const {h,skill}=await retailFixture()
 try {
  await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
  assert.deepEqual(status.api.rpcs,REQUIRED_RPCS)
  assert.deepEqual(status.researchApi.rpcs,{hq_worker_research_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
  assert.deepEqual(status.roleApi.rpcs,{hq_worker_role_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
  await assert.rejects(()=>h.rpc('hq_begin_public_retail_trial',[skill,'clothing',randomUUID()]),/HQ_FOUNDER_REQUIRED/)
  await h.as('founder');const row=(await h.rpc('hq_workforce_trial_status')).find(row=>row.agentId==='AG-RES-002')
  assert.equal(row.publicRetail.setupRequired,true);assert.equal(row.publicRetail.eligible,false)
  assert.equal(Object.keys(row.publicRetail).length,12)
  assert.deepEqual(row.publicRetail.categories,['clothing','footwear','homewares'])
  await assert.rejects(()=>h.rpc('hq_begin_public_retail_trial',[skill,'clothing',randomUUID()]),/HQ_RETAIL_CANONICAL_SETUP_REQUIRED/)
  await h.db.exec('reset role')
  for(const table of ['public_retail_tasks','public_retail_receipts','trial_public_policy_receipts'])assert.equal((await h.db.query('select count(*)::int n from hq_private.'+table)).rows[0].n,0)
  await h.as('worker');await assert.rejects(()=>h.db.query('select * from hq_private.trial_public_policy_receipts'),/permission denied/)
 }finally{await h.db.close()}
})

async function currentStatus(h) {
 await h.as('founder');return(await h.rpc('hq_workforce_trial_status')).find(row=>row.agentId==='AG-RES-002').publicRetail
}
async function finishReviews(h,claim,head='AG-RES-001',reviewer='AG-HR-003') {
 let j=await claim();assert.equal(j.agent_id,head);assert.equal(j.context.mode,'head-review')
 await h.finish(j,{accepted:true,summary:'Head checked the generated actual artifact.',artifactDigest:j.context.artifact.digest})
 j=await claim();assert.equal(j.agent_id,reviewer);assert.equal(j.context.mode,'ceo-review')
 await h.finish(j,{accepted:true,summary:'Independent reviewer checked the same generated artifact.',artifactDigest:j.context.artifact.digest})
 j=await claim();assert.equal(j.context.mode,'task-report');await h.finish(j,'The generated fixture was independently reviewed; no external action.')
 assert.equal(await claim(),null)
}
async function scopeTrialWork(h,claim,rpc,args,scope,agent='AG-RES-002',head='AG-RES-001') {
 await h.as('founder');const trial=await h.rpc(rpc,args)
 if(scope!=='public-research-tool-trial-v1') {
  assert.equal(await h.claim(),null,'old worker skips a new-purpose trial before leasing')
  await h.as('worker');assert.equal((await h.rpc('hq_worker_research_claim',[worker,300,1])).job,null,'salon-capable rollback skips retail/evaluator work before lease')
 }
 let j=await claim();assert.equal(j.context.supervisedTrial.scope,scope)
 const manager=j.context.roster.find(row=>row.id===head)
 await h.finish(j,{assigneeId:head,reason:'Fixed manager supervises the generated trial.',message:'@'+manager.name+' supervise.'})
 j=await claim();const hire=j.context.roster.find(row=>row.id===agent)
 await h.finish(j,{message:'@'+hire.name+' execute the selected bounded trial.',delegateId:agent})
 j=await claim();await h.finish(j,{message:'I will execute only the fixed selected exercise.'})
 j=await claim();assert.equal(j.context.mode,'worker-trial');assert.equal(j.agent_id,agent)
 return {trial,j}
}
async function deliveredOutput(h,j,output) {
 const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,
  modelBindingEvidence:output.modelBindingEvidence,modelExecutionEvidence:output.modelExecutionEvidence}
 return {entry,result:await delivery(h,entry)}
}
async function establishBaseline(f) {
 const {h,configured,skill,claim}=f,irisSkill='synthetic_evaluator_retail_skill'
 await h.db.exec('reset role')
 await h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
  values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','Generated evaluator skill.md','text/markdown','1',false,true)`,[irisSkill])
 for(const a of configured)if(a.id==='AG-HR-003')a.skillFileIds=[irisSkill]
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 let work=await scopeTrialWork(h,claim,'hq_begin_evaluator_trial',[irisSkill,randomUUID()],'evaluator-skill-trial-v1','AG-HR-003','AG-HR-001')
 const output=await fake([],config=>invokeCodex({...config,id:worker},work.j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0'})
 await deliveredOutput(h,work.j,output);await finishReviews(h,claim,'AG-HR-001','AG-CEO-001')
 await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[work.trial.trialId])
 for(const a of configured)if(a.id==='AG-HR-003')a.lifecycle='Active / Qualified'
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 work=await scopeTrialWork(h,claim,'hq_begin_public_research_trial',[skill,randomUUID()],'public-research-tool-trial-v1')
 const baselineDelivery=await deliveredOutput(h,work.j,await publicDiscoveryOutput(work.j));await finishReviews(h,claim)
 await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[work.trial.trialId])
 for(const a of configured)if(a.id==='AG-RES-002')a.lifecycle='Active / Qualified'
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 await h.db.exec('reset role')
 const receipts=(await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows
 if(!f.retailInstalled) {
  await h.db.exec(await readFile(new URL(retailMigration,root),'utf8'))
  const oldArtifact=(await h.db.query('select id from public.hq_task_artifacts where job_id=$1',[work.j.id])).rows[0].id
  await h.db.query('select hq_private.record_trial_host_execution($1,$2,$3,$4::jsonb,$5)',[work.trial.trialId,work.j.id,oldArtifact,JSON.stringify(baselineDelivery.entry.modelBindingEvidence),'worker-job:'+work.j.id])
  assert.equal((await h.db.query('select count(*)::int n from hq_private.trial_public_policy_receipts')).rows[0].n,0,'historical host receipt replay does not manufacture module metadata')
  f.retailInstalled=true
 }
 assert.equal((await currentStatus(h)).setupRequired,true)
 await h.as('founder');await assert.rejects(()=>h.rpc('hq_begin_public_retail_trial',[skill,'clothing',randomUUID()]),/HQ_RETAIL_CANONICAL_SETUP_REQUIRED/)
 await h.db.exec('reset role');await h.db.query("update hq_private.brain_files set source_version='2' where file_id='synthetic_research_profile'")
 assert.equal((await currentStatus(h)).setupRequired,false)
 assert.equal((await currentStatus(h)).eligible,true,'a genuine new fixed-scope trial is allowed after canonical revision invalidates current qualification')
 return receipts
}

test('real CLI retail trial preserves current salon history, binds category/module, reviews independently and qualifies one finite policy',async()=>{
 const f=await retailFixture(false),{h,skill,claim}=f
 try {
  const prior=await establishBaseline(f),key=randomUUID()
  const {trial,j}=await scopeTrialWork(h,claim,'hq_begin_public_retail_trial',[skill,'clothing',key],'public-retail-tool-trial-v1')
  assert.deepEqual(Object.keys(j.context.publicDiscoveryPermit).sort(),['version','policyId','jobId','agentId','bindingDigest','category'].sort())
  assert.equal(j.context.publicDiscoveryPermit.category,'clothing');assert.equal(j.context.supervisedTrial.category,'clothing')
  await h.as('founder');assert.equal((await h.rpc('hq_begin_public_retail_trial',[skill,'clothing',key])).trialId,trial.trialId)
  await assert.rejects(()=>h.rpc('hq_begin_public_retail_trial',[skill,'footwear',key]),/HQ_TRIAL_REQUEST_KEY_REUSED/)
  await h.db.exec('reset role;begin')
  try {
   let failure
   try { await fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,publicDiscoveryCategory:'clothing',nullEffort:true}}) }
   catch(error) { failure=error }
   assert.equal(failure?.code,'provider-model-resolution-invalid')
   const failedEntry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:failure.code,evidence:[],modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:null}
   const failedDelivery=await delivery(h,failedEntry)
   assert.equal(failedDelivery.trialReceiptAccepted,true)
   assert.deepEqual(await delivery(h,failedEntry),failedDelivery,'actual pre-turn failure settles durably without replaying inference')
   assert.equal((await currentStatus(h)).status,'failed');assert.equal((await currentStatus(h)).qualified,false)
   await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_retail_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  } finally { await h.db.exec('rollback;reset role') }
  for(const code of ['discovery-access-denied','discovery-rate-limited','discovery-response-too-large','discovery-dns-rejected','discovery-source-unavailable','discovery-result-invalid','discovery-budget-exhausted','discovery-unavailable-no-retry']){
   await h.db.exec('reset role;begin')
   try {
    const item={id:'diagnostic-fixture',type:'mcpToolCall',server:'hq_public_discovery',tool:'public_business_discovery',arguments:{},status:'completed',error:null,result:{isError:true,content:[{type:'text',text:code}]}}
    let failure
    try { await fake([],config=>invokeCodex({...config,id:worker},j,[],AbortSignal.timeout(5000)),{cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,publicDiscoveryCategory:'clothing',events:[{method:'item/completed',params:{item}}],turnItems:[item]}}) }
    catch(error) { failure=error }
    assert.equal(failure?.code,code);assert.deepEqual(failure.modelBindingEvidence.observedErrors,[code])
    const entry={job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:'',error:code,evidence:[],modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:null}
    const result=await delivery(h,entry)
    assert.equal(result.trialReceiptAccepted,true)
    assert.deepEqual(await delivery(h,entry),result,'failed diagnostic delivery retries do not rerun inference')
    assert.equal((await currentStatus(h)).status,'failed');assert.equal((await currentStatus(h)).qualified,false)
    await h.db.exec('reset role')
    assert.equal((await h.db.query('select count(*)::int n from hq_private.public_retail_receipts where job_id=$1',[j.id])).rows[0].n,0,'an error diagnostic is not a public-source receipt')
    assert.deepEqual((await h.db.query('select outcome,observed_errors from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows,[{outcome:'failed',observed_errors:[code]}])
    await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_retail_qualification',[trial.trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
   } finally { await h.db.exec('rollback;reset role') }
  }
  const output=await publicDiscoveryOutput(j)
  assert.equal(output.evidence[0].policyId,'exa-public-retail-discovery-v1')
  assert.equal(output.evidence[0].queryId,'new-cairo-retail-clothing-v1')
  assert.equal(output.modelBindingEvidence.publicDiscoveryPolicy.category,'clothing')
  for(const mutate of [
   proof=>{proof.publicDiscoveryPolicy.moduleSha256='invalid'},
   proof=>{proof.publicDiscoveryPolicy.category='footwear'},
   proof=>{proof.publicDiscoveryPolicy.extra='unexpected'},
  ]) {
   const bad=structuredClone(output.modelBindingEvidence);mutate(bad)
   await h.as('worker')
   await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,output.reply,null,JSON.stringify(output.evidence),JSON.stringify(output.modelExecutionEvidence),JSON.stringify(bad)]),/HQ_PUBLIC_POLICY_METADATA_INVALID/)
  }
  for(const mutate of [e=>{e.queryId='new-cairo-retail-footwear-v1'},e=>{e.bindingDigest='0'.repeat(64)}]) {
   const bad=structuredClone(output.evidence);mutate(bad[0]);await h.as('worker')
   await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,output.reply,null,JSON.stringify(bad),JSON.stringify(output.modelExecutionEvidence),JSON.stringify(output.modelBindingEvidence)]),/HQ_DISCOVERY_EVIDENCE_INVALID/)
  }
  for(const file of ['synthetic_research_profile',skill]) await assertFirstFinishDrift(h,j,output,file,trial.trialId)
  const delivered=await deliveredOutput(h,j,output)
  assert.equal(delivered.result.trialReceiptAccepted,true)
  await h.db.exec('reset role')
  const stored=(await h.db.query('select policy_id,module_sha256,policy_metadata,job_id from hq_private.trial_public_policy_receipts where job_id=$1',[j.id])).rows[0]
  assert.equal(stored.policy_id,'exa-public-retail-discovery-v1');assert.equal(stored.policy_metadata.category,'clothing')
  assert.equal(stored.module_sha256,output.modelBindingEvidence.publicDiscoveryPolicy.moduleSha256)
  assert.deepEqual(await delivery(h,delivered.entry),delivered.result)
  await finishReviews(h,claim)
  assert.equal((await currentStatus(h)).reviewComplete,true)
  await h.as('founder');await h.rpc('hq_issue_public_retail_qualification',[trial.trialId])
  assert.equal((await currentStatus(h)).qualified,true)
  assert.equal((await currentStatus(h)).lastCategory,'clothing')
  assert.deepEqual((await currentStatus(h)).categories,['clothing','footwear','homewares'])
  await h.db.exec('reset role')
  assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts where trial_id<>$1 order by receipt_id',[trial.trialId])).rows,prior)
  assert.equal((await h.db.query("select count(*)::int n from hq_private.public_retail_tasks where category in ('footwear','homewares')")).rows[0].n,0,'other categories are not falsely recorded as exercised')
  const currentBinding=(await h.db.query("select hq_private.workforce_agent_binding_digest('AG-RES-002') d")).rows[0].d
  const salon=await scopeTrialWork(h,claim,'hq_begin_public_research_trial',[skill,randomUUID()],'public-research-tool-trial-v1')
  await deliveredOutput(h,salon.j,await publicDiscoveryOutput(salon.j));await finishReviews(h,claim)
  await h.as('founder');await h.rpc('hq_issue_public_research_qualification',[salon.trial.trialId])
  assert.equal((await currentStatus(h)).setupRequired,false,'later same-profile salon qualification cannot replace the historical setup baseline')
  assert.equal((await currentStatus(h)).qualified,true,'retail qualification survives salon requalification without a binding change')
  await h.db.exec('reset role')
  assert.equal((await h.db.query("select hq_private.workforce_agent_binding_digest('AG-RES-002') d")).rows[0].d,currentBinding)
  const salonPolicy=(await h.db.query('select policy_metadata from hq_private.trial_public_policy_receipts where job_id=$1',[salon.j.id])).rows[0].policy_metadata
  assert.equal(Object.keys(salonPolicy).length,6,'new salon receipts retain exact six-key metadata')
  await verifyOrdinaryScope(h,claim)
 }finally{await h.db.close()}
})

async function verifyOrdinaryScope(h,claim) {
 await h.as('founder');await h.rpc('hq_create_task',['Generated retail scope','Research a bounded New Cairo retail category; synthetic fixture source profile_source_1.','Return literal source evidence only.',null,randomUUID()])
 let j=await claim();await h.finish(j,{assigneeId:'AG-RES-001',reason:'Fixed Research head scopes this task.',message:'@Employee 4 scope.'})
 const ack=await claim();assert.equal(ack.context.roster.find(row=>row.id==='AG-RES-002').publicRetailQualified,true)
 const body={message:'@Synthetic Research Worker execute the fixed category scope.',delegateId:'AG-RES-002',publicDiscoveryPolicy:'exa-public-retail-discovery-v1',publicDiscoveryCategory:'footwear'}
 for(const mutate of [b=>{delete b.publicDiscoveryCategory},b=>{delete b.publicDiscoveryPolicy},b=>{b.publicDiscoveryCategory='unbounded'},b=>{b.delegateId='AG-HR-002'},b=>{b.extra=true}]) {
  const bad=structuredClone(body);mutate(bad);await h.as('worker')
  await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[ack.id,ack.lease_token,worker,JSON.stringify(bad),null,'[]',null,null]),/HQ_DISCOVERY_SELECTION_INVALID/)
 }
 const entry={job:{id:ack.id,lease_token:ack.lease_token},phase:'finished',reply:JSON.stringify(body),error:null,evidence:[],modelBindingEvidence:null,modelExecutionEvidence:null}
 assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,true)
 assert.equal((await delivery(h,entry)).publicDiscoveryPolicyAccepted,true)
 assert.equal(await h.claim(),null)
 await h.as('worker');assert.equal((await h.rpc('hq_worker_research_claim',[worker,300,1])).job,null)
 await h.db.exec('reset role')
 const task=(await h.db.query('select * from hq_private.public_retail_tasks where task_id=$1',[ack.context.task.id])).rows[0]
 assert.equal(task.category,'footwear')
 await assert.rejects(()=>h.db.query("update hq_private.public_retail_tasks set category='homewares' where task_id=$1",[task.task_id]),/HQ_IMMUTABLE_RECORD/)
 const waiting=(await h.db.query("select id from public.hq_agent_jobs where task_id=$1 and status='queued'",[task.task_id])).rows[0]
 await assert.rejects(()=>h.db.query("update public.hq_agent_jobs set status='working',worker_id=$1,lease_token=gen_random_uuid() where id=$2",[worker,waiting.id]),/HQ_ROLE_CLIENT_REQUIRED/)
 j=await claim();await h.finish(j,{message:'I will use only the frozen bounded category scope.'})
 j=await claim();assert.equal(j.context.publicDiscoveryPermit.category,'footwear')
 const output=await publicDiscoveryOutput(j);await assertFirstFinishDrift(h,j,output,'synthetic_retail_skill');const delivered=await deliveredOutput(h,j,output)
 assert.equal(delivered.result.publicDiscoveryReceiptAccepted,true);assert.equal(delivered.result.trialReceiptAccepted,undefined)
 await h.db.exec('reset role')
 assert.equal((await h.db.query('select count(*)::int n from hq_private.trial_public_policy_receipts where job_id=$1',[j.id])).rows[0].n,0,'ordinary work never invents a trial/module receipt')
 let review=await claim();await h.finish(review,{accepted:false,summary:'Generated wording needs a bounded text-only repair.',artifactDigest:review.context.artifact.digest})
 const repair=await claim();assert.equal(repair.context.mode,'task-start');assert.equal(repair.context.task.attempt,1)
 await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_finish_v4',[repair.id,repair.lease_token,worker,JSON.stringify(body),null,'[]',null,null]),/HQ_DISCOVERY_SELECTION_INVALID/)
 await h.finish(repair,{message:'I will correct wording from the original preserved receipts only.'})
 j=await claim()
 assert.equal(j.context.task.attempt,1);assert.equal(j.context.publicDiscoveryEvidence.length,1)
 await h.as('founder');await h.rpc('hq_cancel_task',[task.task_id])
}

async function assertFirstFinishDrift(h,j,output,file,trialId=null) {
 await h.db.exec('reset role;begin')
 try {
  await h.db.query("update hq_private.brain_files set source_version='3' where file_id=$1",[file])
  const delivered=await deliveredOutput(h,j,output)
  assert.equal(delivered.result.discarded,true);assert.equal(delivered.result.bindingStale,true)
  assert.equal(delivered.result.trialReceiptAccepted,undefined,'stale proof is never promoted as accepted host evidence')
  assert.deepEqual(await delivery(h,delivered.entry),delivered.result,'exact original first-finish input replays without inference or fresh binding')
  await h.db.exec('reset role')
  assert.deepEqual((await h.db.query('select status,error from public.hq_agent_jobs where id=$1',[j.id])).rows[0],{status:'blocked',error:'public-discovery-binding-stale'})
  assert.equal((await h.db.query('select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).rows[0].n,0)
  assert.equal((await h.db.query('select count(*)::int n from hq_private.workforce_trial_host_execution_receipts where worker_job_id=$1',[j.id])).rows[0].n,0)
  const observation=(await h.db.query('select outcome,artifact_id,binding_digest,evidence from hq_private.public_retail_receipts where job_id=$1',[j.id])).rows[0]
  assert.equal(observation.outcome,'blocked');assert.equal(observation.artifact_id,null)
  assert.equal(observation.binding_digest,j.context.publicDiscoveryPermit.bindingDigest);assert.deepEqual(observation.evidence,output.evidence[0])
  if(trialId) {
   assert.equal((await currentStatus(h)).status,'failed','stale trial closes rather than remaining active')
   assert.equal((await currentStatus(h)).qualified,false)
   await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_public_retail_qualification',[trialId]),/HQ_TRIAL_EVIDENCE_INCOMPLETE/)
  }
 } finally { await h.db.exec('rollback;reset role') }
}
