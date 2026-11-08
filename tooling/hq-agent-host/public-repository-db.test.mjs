/** Generated synthetic PostgreSQL + actual worker/CLI contract. No hosted calls. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { fake } from './test-cli.mjs'
import { deliverWorkerEntry, invokeCodex, failedToolEvidence, checkRepositoryContract } from './worker.mjs'
import { REQUIRED_RPCS } from './maintenance.mjs'
import { PUBLIC_REPOSITORY_MANIFEST, PUBLIC_REPOSITORY_MANIFEST_DIGEST } from './departmentWorkflow.mjs'

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

const evidenceMigration='20261108030332_hq_task_evidence_context.sql'
const qualificationBudgetMigration='20261108054818_hq_qualification_query_budget.sql'
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

const repositoryMigration='20261108212105_hq_public_repository_read.sql'
const sourcePreset='hq-worker-boundary-v1',ciPreset='hq-ci-config-v1',sourceSha='a'.repeat(40)
const hash=x=>createHash('sha256').update(x).digest('hex')
const skills={source:'synthetic_repository_source_skill',ci:'synthetic_repository_ci_skill',iris:'synthetic_repository_evaluator_skill'}
const developers=['AG-DEV-002','AG-DEV-003','AG-DEV-004']
async function scalar(h,sql,args=[]){await h.db.exec('reset role');return(await h.db.query(sql,args)).rows[0]}
const delivery=(h,entry)=>deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write:async()=>{},rpc:async(name,input)=>{
 await h.as('worker');return h.rpc(name,Object.values(input).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))
}},entry)
const entryFor=(j,out)=>({version:3,job:{id:j.id,lease_token:j.lease_token},phase:'finished',reply:out.reply,error:null,evidence:out.evidence,
 modelBindingEvidence:out.modelBindingEvidence,modelExecutionEvidence:out.modelExecutionEvidence})
async function output(j,{repository=false,events=[],turnStatus='completed',appServer={},cliVersion='codex-cli 0.160.0',signal=AbortSignal.timeout(10000)}={}){
 const state=await mkdtemp(join(tmpdir(),'hq-repository-db-'))
 try{return await fake([],config=>invokeCodex({...config,id:worker,state},j,[],signal),{
  cliVersion,appServer:{...(repository?{publicRepository:true}:{}),events,turnStatus,...appServer},
 })}finally{await rm(state,{recursive:true,force:true})}
}
function repositoryItem(j){
 const selection=j.context.publicRepositoryPermit.selection,spec=PUBLIC_REPOSITORY_MANIFEST.presets.find(x=>x.id===selection.preset)
 assert.ok(spec,'fixture preset must come from the real reviewed manifest')
 const observedAt=new Date().toISOString()
 const bundle={version:1,repositoryId:1376504404,repositoryFullName:'Building-Suit/building-suit-monorepo',manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,
  selection,resolvedSha:selection.sha,revisionObservedAt:observedAt,observedAt,requestAttempts:selection.preset===ciPreset?12:7,bytesRead:1024,
  files:spec.files.map(file=>({path:file.path,blobSha:'c'.repeat(40),bytes:1024,sha256:'d'.repeat(64),windows:file.windows.map(([start,end])=>{
   const text='Synthetic literal public source window; no code was executed.';return{start,end,text,sha256:hash(text),truncated:false}
  })})),ci:{state:selection.preset===ciPreset?'unavailable':'not-requested',runs:[],checks:[],jobs:[],unknownReasons:selection.preset===ciPreset?['runs-http-404']:[]},
  partial:true,authentication:'none',codeExecuted:false,writesPerformed:false,testedSourceSha:'unknown',executedByThisEmployee:false,requiredChecksVerified:false}
 const text=JSON.stringify(bundle),item={type:'mcpToolCall',id:'synthetic_repository_read',server:'hq_public_repository',tool:'read_public_repository_bundle',arguments:{},status:'completed',error:null,
  result:{content:[{type:'text',text}],structuredContent:{version:1,kind:'mcp-public-github-read',policyId:'hq-public-github-read-v1',repositoryId:1376504404,
   manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,selection,observedAt:bundle.observedAt,bundleSha256:hash(text),bundleBytes:Buffer.byteLength(text)}}}
 return{bundle,item,event:{method:'item/completed',params:{item}}}
}
async function finishReviews(h,claim,head='AG-DEV-001',reviewer='AG-HR-003',ordinary=false){
 let j=await claim();assert.equal(j.context.mode,'head-review');assert.equal(j.agent_id,head)
 const artifact=j.context.artifact
 await h.finish(j,{accepted:true,summary:'Generated head review binds the exact synthetic artifact.',artifactDigest:artifact.digest})
 j=await claim();assert.equal(j.context.mode,'ceo-review');assert.equal(j.agent_id,reviewer);assert.equal(j.context.artifact.id,artifact.id)
 await h.finish(j,{accepted:true,summary:'Generated independent review checks the same artifact.',artifactDigest:artifact.digest})
 j=await claim();assert.equal(j.context.mode,'task-report');await h.finish(j,'Generated reviewed internal report; no execution or external action.')
 if(ordinary){
  j=await claim();assert.equal(j.context.mode,'lesson-extract')
  await h.finish(j,{summary:'Synthetic bounded source lesson',body:'Preserve source identity and explicit uncertainty in this generated fixture.'})
  j=await claim();assert.equal(j.context.mode,'lesson-review')
  await h.finish(j,{accepted:true,summary:'Synthetic lesson remains scoped to the generated evidence.'})
 }
 assert.equal(await claim(),null)
 return artifact
}
async function scopeWork(h,claim,rpc,args,agent,head){
 await h.as('founder');const trial=await h.rpc(rpc,args)
 let j=await claim();assert.equal(j.context.mode,'task-route')
 await h.finish(j,{assigneeId:head,reason:'The fixed manager scopes the synthetic exercise.',message:'@'+j.context.roster.find(x=>x.id===head).name+' supervise.'})
 j=await claim();assert.equal(j.context.mode,'task-ack')
 await h.finish(j,{message:'@'+j.context.roster.find(x=>x.id===agent).name+' execute only the selected bounded exercise.',delegateId:agent})
 j=await claim();assert.equal(j.context.mode,'trial-start');assert.equal(j.context.publicRepositoryPermit,undefined,'acknowledgment has no network reservation')
 await h.finish(j,{message:'I acknowledge the fixed exercise without external actions.'})
 j=await claim();assert.equal(j.context.mode,'worker-trial');assert.equal(j.agent_id,agent)
 return{trial,j}
}
async function repositoryFixture(){
 const h=await setup(true,true,true,true),configured=structuredClone(roster)
 await installTaskEvidence(h)
 await h.db.exec('reset role')
 for(const file of ['20261108153026_hq_public_discovery_mcp.sql','20261108180216_hq_public_research_trial_status.sql','20261108200149_hq_evaluator_qualification_status.sql','20261108200632_hq_public_retail_discovery.sql'])
  await h.db.exec(await readFile(new URL(file,root),'utf8'))
 const add=async(id,name,parent,mime='application/vnd.google-apps.folder')=>h.db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope)
  values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',$2,$3,$4,'1',false,true)`,[id,[parent],name,mime])
 await add('synthetic_departments','Departments','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')
 await add('synthetic_development','Development','synthetic_departments');await add('synthetic_development_skills','Skills','synthetic_development')
 await add('synthetic_source_folder','shop-maintenance-triage','synthetic_development_skills')
 await add('synthetic_ci_folder','devops-platform-operations','synthetic_development_skills')
 await add(skills.source,'SKILL.md','synthetic_source_folder','text/markdown');await add(skills.ci,'SKILL.md','synthetic_ci_folder','text/markdown')
 await add(skills.iris,'Synthetic evaluator.md','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','text/markdown')
 configured.find(x=>x.id==='AG-HR-003').skillFileIds=[skills.iris]
 for(const [index,id]of developers.entries()){
  const profile='synthetic_developer_profile_'+index;await add(profile,'Synthetic developer '+index+'.md','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','text/markdown')
  configured.push({id,name:'Synthetic Developer '+index,role:'Fixture',departmentKey:'development-maintenance',profileFileId:profile,
   skillFileIds:index===2?[skills.ci,skills.source]:[skills.source],lifecycle:'configured trial pending',model:'gpt-6.1-terra',effort:'medium',managerId:'AG-DEV-001',modelTier:'T1_WORKER'})
 }
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 assert.equal(await h.claim(),null,'warm the old 11-RPC consumer before installing the new capability')
 await h.as('worker')
 for(const name of ['hq_worker_research_claim','hq_worker_role_claim'])assert.equal((await h.rpc(name,[worker,300,1])).job,null)
 await h.db.exec('reset role');await h.db.exec(await readFile(new URL(repositoryMigration,root),'utf8'))
 const roleClaim=async()=>{await h.as('worker');return(await h.rpc('hq_worker_role_claim',[worker,300,1])).job}
 let work=await scopeWork(h,roleClaim,'hq_begin_evaluator_trial',[skills.iris,randomUUID()],'AG-HR-003','AG-HR-001')
 await delivery(h,entryFor(work.j,await output(work.j)));await finishReviews(h,roleClaim,'AG-HR-001','AG-CEO-001')
 await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[work.trial.trialId])
 configured.find(x=>x.id==='AG-HR-003').lifecycle='Active / Qualified'
 await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 for(const id of developers){
  for(const skill of configured.find(x=>x.id===id).skillFileIds){
   work=await scopeWork(h,roleClaim,'hq_begin_supervised_worker_trial',[id,skill,randomUUID()],id,'AG-DEV-001')
   await delivery(h,entryFor(work.j,await output(work.j)));await finishReviews(h,roleClaim)
   await h.as('founder');await h.rpc('hq_issue_workforce_qualification',[work.trial.trialId])
  }
  configured.find(x=>x.id===id).lifecycle='Active / Qualified'
  await h.as('worker');await h.rpc('hq_worker_sync_roster',[worker,JSON.stringify(configured)])
 }
 await h.db.exec('reset role');const ordinary=(await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows
 h.finish=async(j,reply,error=null,evidence=[])=>{await h.as('worker');return h.rpc('hq_worker_finish_v4',[
  j.id,j.lease_token,worker,typeof reply==='string'?reply:JSON.stringify(reply),error,JSON.stringify(evidence),null,null,
 ])}
 const claim=async()=>{await h.as('worker');return(await h.rpc('hq_worker_repository_claim',[worker,300,1])).job}
 return{h,configured,ordinary,claim,roleClaim}
}
async function freeze(h,id,preset=sourcePreset,sha=sourceSha,predecessor=null,key=randomUUID(),mode='snapshot',pr=null){
 await h.as('founder');return h.rpc('hq_freeze_repository_bundle',[id,preset,mode,sha,pr,predecessor,key])
}
async function repositoryWork(f,id='AG-DEV-002',bundleId=null){
 const{h,claim}=f
 bundleId??=(await freeze(h,id,id==='AG-DEV-004'?ciPreset:sourcePreset)).bundleId
 await h.as('founder');const request=randomUUID(),trial=await h.rpc('hq_begin_repository_trial',[id,bundleId,request])
 assert.equal((await h.rpc('hq_begin_repository_trial',[id,bundleId,request])).trialId,trial.trialId)
 assert.equal(await h.claim(),null,'legacy consumer skips repository scope before leasing')
 await h.as('worker');assert.equal((await h.rpc('hq_worker_research_claim',[worker,300,1])).job,null)
 assert.equal(await f.roleClaim(),null,'role-capable rollback does not lease repository scope')
 assert.equal((await scalar(h,"select count(*)::int n from public.hq_agent_jobs where task_id=$1 and status='working'",[trial.taskId])).n,0)
 let j=await claim();await h.finish(j,{assigneeId:'AG-DEV-001',reason:'Adam scopes the fixed source bundle.',message:'@Employee 9 supervise.'})
 j=await claim();await h.finish(j,{message:'@'+j.context.roster.find(x=>x.id===id).name+' inspect only the fixed public snapshot.',delegateId:id})
 j=await claim();assert.equal(j.context.publicRepositoryPermit,undefined)
 assert.ok(j.context.supervisedTrial.repositorySelection);await h.finish(j,{message:'I will use the frozen read-only scope.'})
 j=await claim();assert.equal(j.context.mode,'worker-trial')
 assert.deepEqual(Object.keys(j.context.publicRepositoryPermit).sort(),['version','policyId','jobId','agentId','bindingDigest','selection','reservationId','manifestDigest','expiresAt'].sort())
 return{trial,j,bundleId}
}

async function ordinaryWork(f,bundleId,{ackMutations=[]}={}){
 const{h,claim}=f
 await h.as('founder');await h.rpc('hq_create_task',['Synthetic frozen repository inspection','Inspect only the founder-frozen public repository scope.','Return source-bound findings and explicit uncertainty.','AG-DEV-001',randomUUID()])
 let j=await claim();await h.finish(j,{assigneeId:'AG-DEV-001',reason:'Adam scopes the fixed source task.',message:'@Employee 9 scope.'})
 j=await claim();assert.equal(j.context.mode,'task-ack');assert.ok(j.context.publicRepositoryBundles.some(x=>x.bundleId===bundleId))
 const ack={message:'@Synthetic Developer 0 inspect only the supplied frozen repository bundle.',delegateId:'AG-DEV-002',publicRepositoryBundleId:bundleId}
 for(const mutate of ackMutations){const bad=structuredClone(ack);mutate(bad);await rejects(h,()=>h.finish(j,bad),/HQ_REPOSITORY_/)}
 const selection=await h.finish(j,ack);assert.equal(selection.repositoryPolicyAccepted,true)
 assert.equal(await h.claim(),null);assert.equal(await f.roleClaim(),null)
 j=await claim();assert.equal(j.context.mode,'task-start');assert.equal(j.context.publicRepositoryPermit,undefined)
 await h.finish(j,{message:'I acknowledge the immutable public source scope.'})
 j=await claim();assert.equal(j.context.mode,'task-work');assert.ok(j.context.publicRepositoryPermit)
 return j
}
async function rejects(h,fn,pattern){
 await h.db.exec('savepoint rejected_repository_input')
 try{await assert.rejects(fn,pattern)}finally{await h.db.exec('rollback to savepoint rejected_repository_input;release savepoint rejected_repository_input')}
}
async function transaction(h,action){
 await h.db.exec('reset role;begin')
 try{return await action()}finally{await h.db.exec('rollback;reset role')}
}
async function count(h,table){return(await scalar(h,'select count(*)::int n from hq_private.'+table)).n}

test('repository read capability is founder-frozen, lease-bound, independently reviewed and durable without upgrading ordinary qualification',async t=>{
 const f=await repositoryFixture(),{h,claim}=f
 try{
  await t.test('old contract remains exact; repository API is separate and authority starts absent',async()=>{
   await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
   assert.deepEqual(status.api.rpcs,REQUIRED_RPCS)
   assert.deepEqual(status.researchApi.rpcs,{hq_worker_research_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
   assert.deepEqual(status.roleApi.rpcs,{hq_worker_role_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
   assert.equal(checkRepositoryContract(status),true)
   for(const table of ['repository_bundles','repository_reservations','repository_receipts','repository_qualifications'])assert.equal(await count(h,table),0)
   await h.as('worker');await assert.rejects(()=>h.rpc('hq_freeze_repository_bundle',['AG-DEV-002',sourcePreset,'snapshot',sourceSha,null,null,randomUUID()]),/HQ_FOUNDER_REQUIRED/)
  })
  let mazen
  await t.test('actual MCP bundle and current model/module proof reaches Adam and Iris before separate repository approval',async()=>{
   const key=randomUUID(),frozen=await freeze(h,'AG-DEV-002',sourcePreset,sourceSha,null,key)
   assert.equal((await freeze(h,'AG-DEV-002',sourcePreset,sourceSha,null,key)).bundleId,frozen.bundleId)
   await assert.rejects(()=>freeze(h,'AG-DEV-002',sourcePreset,'b'.repeat(40),null,key),/HQ_REPOSITORY_REQUEST_CONFLICT/)
   const{trial,j}=await repositoryWork(f,'AG-DEV-002',frozen.bundleId),wire=repositoryItem(j)
   assert.equal(await count(h,'repository_reservations'),1)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,12)
   const out=await output(j,{repository:true,events:[wire.event]}),entry=entryFor(j,out)
   assert.equal(out.evidence[0].bundleText,JSON.stringify(wire.bundle));assert.equal(out.evidence[0].bundleSha256,hash(out.evidence[0].bundleText))
   const delivered=await delivery(h,entry)
   assert.equal(delivered.repositoryReceiptAccepted,true);assert.equal(delivered.publicDiscoveryReceiptAccepted,true);assert.equal(delivered.trialReceiptAccepted,true)
   assert.deepEqual(await delivery(h,entry),delivered,'exact lost-response replay returns the cached result')
   await assert.rejects(()=>delivery(h,{...entry,reply:entry.reply+' changed'}),/HQ_REPOSITORY_/)
   await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_repository_qualification',[trial.trialId]),/HQ_REPOSITORY_/)
   const artifact=await finishReviews(h,claim)
   await h.as('founder');const qualified=await h.rpc('hq_issue_repository_qualification',[trial.trialId]);assert.equal(qualified.accepted,true)
   assert.equal((await h.rpc('hq_issue_repository_qualification',[trial.trialId])).receiptId,qualified.receiptId)
   await h.db.exec('reset role')
   assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows,f.ordinary)
   mazen={trial,artifact,bundleId:frozen.bundleId,entry,result:delivered}
  })
  if(!mazen)return // Later scenarios require the genuinely reviewed first artifact.
  await t.test('Farah accepts only the same-SHA completed Mazen predecessor; Samir gets the fixed CI preset',async()=>transaction(h,async()=>{
   await rejects(h,()=>freeze(h,'AG-DEV-003',sourcePreset,sourceSha,null),/HQ_REPOSITORY_BUNDLE_INVALID/)
   await rejects(h,()=>freeze(h,'AG-DEV-003',sourcePreset,'b'.repeat(40),mazen.artifact.id),/HQ_REPOSITORY_SETUP_REQUIRED/)
   const farah=await freeze(h,'AG-DEV-003',sourcePreset,sourceSha,mazen.artifact.id)
   let work=await repositoryWork(f,'AG-DEV-003',farah.bundleId)
   assert.equal(work.j.context.repositoryPredecessor.artifactId,mazen.artifact.id)
   assert.equal(work.j.context.repositoryPredecessor.digest,mazen.artifact.digest)
   assert.equal(work.j.context.repositoryPredecessor.evidence.selection.sha,sourceSha)
   let wire=repositoryItem(work.j);await delivery(h,entryFor(work.j,await output(work.j,{repository:true,events:[wire.event]})))
   await finishReviews(h,claim);await h.as('founder');assert.equal((await h.rpc('hq_issue_repository_qualification',[work.trial.trialId])).accepted,true)
   await rejects(h,()=>freeze(h,'AG-DEV-004',sourcePreset),/HQ_REPOSITORY_BUNDLE_INVALID/)
   work=await repositoryWork(f,'AG-DEV-004');assert.equal(work.j.context.publicRepositoryPermit.selection.preset,ciPreset)
   wire=repositoryItem(work.j);assert.equal(wire.bundle.requiredChecksVerified,false)
   await delivery(h,entryFor(work.j,await output(work.j,{repository:true,events:[wire.event]})))
   await finishReviews(h,claim);await h.as('founder');assert.equal((await h.rpc('hq_issue_repository_qualification',[work.trial.trialId])).accepted,true)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,36)
  }))
  await t.test('ordinary Adam selection freezes only the original task; repair reuses original reservation with no MCP or qualification upgrade',async()=>transaction(h,async()=>{
   const j=await ordinaryWork(f,mazen.bundleId,{ackMutations:[x=>x.extra='private',x=>x.publicRepositoryBundleId=randomUUID(),x=>x.delegateId='AG-DEV-003']})
   const wire=repositoryItem(j),out=await output(j,{repository:true,events:[wire.event]}),entry=entryFor(j,out)
   assert.equal(out.modelBindingEvidence.trialId,null)
   const result=await delivery(h,entry);assert.equal(result.repositoryReceiptAccepted,true)
   assert.equal(result.publicDiscoveryReceiptAccepted,true);assert.equal(result.trialReceiptAccepted,true,'old runtime compatibility acknowledgment does not grant ordinary qualification')
   let review=await claim();await h.finish(review,{accepted:false,summary:'Repair wording using only the same literal read.',artifactDigest:review.context.artifact.digest})
   let repair=await claim();assert.equal(repair.context.mode,'task-start');assert.equal(repair.context.task.attempt,1)
   await rejects(h,()=>h.finish(repair,{message:'Change scope.',publicRepositoryBundleId:mazen.bundleId}),/HQ_REPOSITORY_/)
   await h.finish(repair,{message:'I will repair text using the original source receipt.'})
   repair=await claim();assert.equal(repair.context.task.attempt,1)
   assert.equal(repair.context.publicRepositoryPermit.reservationId,j.context.publicRepositoryPermit.reservationId)
   assert.equal(repair.context.publicRepositoryPermit.jobId,repair.id)
   assert.equal(repair.context.repositoryEvidence.length,1)
   assert.equal(repair.context.repositoryEvidence[0].jobId,j.id)
   assert.equal(repair.context.repositoryEvidence[0].evidence.bundleSha256,out.evidence[0].bundleSha256)
   const repaired=await output(repair);assert.deepEqual(repaired.evidence,[])
   assert.deepEqual(repaired.modelBindingEvidence.invocation.protocol.threadStart.params.config.mcp_servers,{})
   await delivery(h,entryFor(repair,repaired));await finishReviews(h,claim,'AG-DEV-001','AG-CEO-001',true)
   assert.equal(await count(h,'repository_reservations'),2,'repair never buys another network read')
   await h.db.exec('reset role');assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows,f.ordinary)
  }))
  await t.test('malformed scope, freeform/secret-shaped inputs and extra arguments cannot become founder-frozen authority',async()=>transaction(h,async()=>{
   for(const args of [
    ['AG-DEV-002','tooling/private','snapshot',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'https://example.invalid/?token=synthetic',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'snapshot','sb_secret_synthetic_not_a_credential',null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'approved-pr',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'snapshot',sourceSha,123,null,randomUUID()],
   ])await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_freeze_repository_bundle',args)},/HQ_REPOSITORY_BUNDLE_INVALID/)
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_freeze_repository_bundle',['AG-DEV-002',sourcePreset,'snapshot',sourceSha,null,null,randomUUID(),'extra'])},/does not exist/)
   const expired=await scalar(h,`insert into hq_private.repository_bundles select (jsonb_populate_record(null::hq_private.repository_bundles,to_jsonb(b)||jsonb_build_object(
    'id',gen_random_uuid(),'request_key',gen_random_uuid(),'created_at',clock_timestamp()-interval '25 hours','expires_at',clock_timestamp()-interval '2 hours'))).* from hq_private.repository_bundles b where b.id=$1 returning id`,[mazen.bundleId])
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_begin_repository_trial',['AG-DEV-002',expired.id,randomUUID()])},/HQ_REPOSITORY_SETUP_REQUIRED/)
  }))
  await t.test('first delivery rejects malformed/raw-hash/current-model proof; source, reviewer and manager drift settle blocked and replay without promotion',async()=>transaction(h,async()=>{
   const j=await ordinaryWork(f,mazen.bundleId),wire=repositoryItem(j),out=await output(j,{repository:true,events:[wire.event]}),entry=entryFor(j,out)
   const rpcEntry=async e=>{await h.as('worker');return h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,e.reply,e.error,JSON.stringify(e.evidence),JSON.stringify(e.modelExecutionEvidence),JSON.stringify(e.modelBindingEvidence)])}
   for(const mutate of [
    x=>x.evidence[0].bundleSha256='0'.repeat(64),
    x=>x.evidence[0].bundleText+=' ',
    x=>x.evidence[0].extra='untrusted',
    x=>x.modelBindingEvidence.configuredModel='gpt-6-luna',
    x=>x.modelBindingEvidence.hostResolution.model='gpt-6-luna',
    x=>x.modelBindingEvidence.publicRepositoryPolicy.moduleSha256='0'.repeat(64),
    x=>x.modelBindingEvidence.workerSourceDigest='0'.repeat(64),
   ]){const bad=structuredClone(entry);mutate(bad);await rejects(h,()=>rpcEntry(bad),/HQ_REPOSITORY_(EVIDENCE|HOST)_INVALID/)}
   const badItem=structuredClone(wire.item);badItem.arguments={query:'synthetic private input must not reach a tool'}
   await assert.rejects(()=>output(j,{repository:true,events:[{method:'item/completed',params:{item:badItem}}]}),/provider-tool-rejected/)
   for(const options of [
    {cliVersion:'codex-cli 0.0.0'},
    {appServer:{missingSettings:true}},
    {appServer:{modelMismatch:true}},
    {events:[{method:'model/rerouted',params:{fromModel:'gpt-6.1-terra',toModel:'gpt-6-luna',reason:'synthetic capacity'}}]},
    {signal:AbortSignal.abort()},
   ]){
    await h.db.exec('reset role;savepoint repository_failed_execution')
    try{
     let failure;try{await output(j,{repository:true,...options})}catch(error){failure=error}
     assert.ok(failure?.code,'a real worker failure must be emitted')
     const failed={...entryFor(j,{reply:'',evidence:failedToolEvidence(failure),modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}),error:failure.code}
     const blocked=await delivery(h,failed);assert.equal(blocked.repositoryReceiptAccepted,true)
     assert.deepEqual(await delivery(h,failed),blocked)
     assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
     assert.equal(await count(h,'repository_reservations'),2)
    }finally{await h.db.exec('rollback to savepoint repository_failed_execution;release savepoint repository_failed_execution')}
   }
   for(const file of ['synthetic_developer_profile_0','profile_source_3','profile_source_9']){
    await h.db.exec('reset role;savepoint repository_binding_drift')
    try{
     await h.db.query("update hq_private.brain_files set source_version='2' where file_id=$1",[file])
     const blocked=await delivery(h,entry);assert.equal(blocked.discarded,true);assert.equal(blocked.bindingStale,true)
     assert.deepEqual(await delivery(h,entry),blocked)
     assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
    }finally{await h.db.exec('rollback to savepoint repository_binding_drift;release savepoint repository_binding_drift')}
   }
   await h.db.exec('reset role;savepoint repository_task_drift')
   try{
    await h.db.query("update public.hq_business_tasks set brief=brief||' changed synthetic scope' where id=$1",[j.context.task.id])
    const blocked=await delivery(h,entry);assert.equal(blocked.discarded,true);assert.equal(blocked.bindingStale,true)
    assert.deepEqual(await delivery(h,entry),blocked)
    assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
   }finally{await h.db.exec('rollback to savepoint repository_task_drift;release savepoint repository_task_drift')}
   const settled=await delivery(h,entry);assert.equal(settled.repositoryReceiptAccepted,true)
  }))
  await t.test('network reservations survive model failure and cancellation; three charge 36 of the global rolling 40 and a fourth cannot start',async()=>transaction(h,async()=>{
   let work=await repositoryWork(f),wire=repositoryItem(work.j),failure
   try{await output(work.j,{repository:true,events:[wire.event],turnStatus:'failed'})}catch(error){failure=error}
   assert.ok(failure);const failed={...entryFor(work.j,{reply:'',evidence:failedToolEvidence(failure),modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}),error:failure.code}
   const blocked=await delivery(h,failed);assert.equal(blocked.repositoryReceiptAccepted,true)
   assert.deepEqual(await delivery(h,failed),blocked);assert.equal(await claim(),null)
   assert.equal(await count(h,'repository_reservations'),2)
   work=await repositoryWork(f);wire=repositoryItem(work.j)
   const out=await output(work.j,{repository:true,events:[wire.event]})
   assert.equal(await claim(),null,'a second claim does not replay a leased original')
   await h.as('founder');await h.rpc('hq_cancel_task',[work.trial.taskId])
   const canceled=await delivery(h,entryFor(work.j,out));assert.equal(canceled.discarded,true)
   assert.equal(await count(h,'repository_reservations'),3)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,36)
   assert.equal((await scalar(h,'select hq_private.repository_budget_remaining() n')).n,4)
   const frozen=await freeze(h,'AG-DEV-004',ciPreset)
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_begin_repository_trial',['AG-DEV-004',frozen.bundleId,randomUUID()])},/HQ_REPOSITORY_SETUP_REQUIRED/)
   assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[work.j.id])).n,0)
  }))
  await t.test('expired lease cannot reclaim an original reservation or reset its charge',async()=>transaction(h,async()=>{
   const{j}=await repositoryWork(f)
   const reservation=j.context.publicRepositoryPermit.reservationId
   await h.db.exec('reset role');await h.db.query("update public.hq_agent_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[j.id])
   assert.equal(await claim(),null)
   assert.equal(await count(h,'repository_reservations'),2)
   assert.equal((await scalar(h,'select id,charged_attempts from hq_private.repository_reservations where job_id=$1',[j.id])).id,reservation)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,24)
  }))
 }finally{await h.db.close()}
})
