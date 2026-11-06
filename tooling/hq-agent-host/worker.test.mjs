/** Mocked CLI only: no model, hosted service or paid API is called. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID, generateKeyPairSync } from 'node:crypto'
import { validateJob, stageInstructions, webAllowed, workerClaimInput, invokeCodex, nativeToolReceipt, providerErrorCode, codeOf, brainReader } from './worker.mjs'
import { workerExecutionBlock } from './departmentWorkflow.mjs'
import { registerHooks } from 'node:module'
// Nuxt resolves these TypeScript source imports; plain Node tests need the same
// extension resolution only inside this shared contract directory.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('./') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/shared/types/')) {
    return nextResolve(specifier + '.ts', context)
  }
  return nextResolve(specifier, context)
} })
const { parseHqAgentSnapshot } = await import('../../apps/company-hq/shared/types/agents.ts')
const job = (id='AG-RES-001',mode='task-work') => ({id:randomUUID(),conversation_id:randomUUID(),agent_id:id,lease_token:randomUUID(),prompt:'Produce a public research draft.',context:{mode,agent:{id,name:'Test employee',model:'gpt-6.1-sol',effort:'medium',profileFileId:'profile_source_1',modelTier:id==='AG-HR-002'?'T1_WORKER':id==='AG-CEO-001'?'T3_EXEC':'T2_HEAD',managerId:id==='AG-HR-002'?'AG-HR-001':id==='AG-CEO-001'?null:'AG-CEO-001',managerModelTier:id==='AG-HR-002'?'T2_HEAD':id==='AG-CEO-001'?null:'T3_EXEC',departmentKey:id==='AG-HR-002'?'hr-agent-development':id==='AG-CEO-001'?null:'research-market-intelligence'},brain_files:[{id:'profile_source_1'}]}})
function qualifiedResearchJob(){
 const value=job('AG-RES-002'),agent=value.context.agent
 Object.assign(agent,{modelTier:'T1_WORKER',managerId:'AG-RES-001',managerModelTier:'T2_HEAD',departmentKey:'research-market-intelligence',
   lifecycle:'Active',headAuthorization:true,skillFileIds:['research_skill_01']})
 agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'a'.repeat(64),evidenceId:'receipt_0001',
   profileFileId:agent.profileFileId,skillFileIds:[...agent.skillFileIds],modelTier:agent.modelTier,managerId:agent.managerId,departmentKey:agent.departmentKey}
 return value
}
async function fake(events,action,{meeting=false}={}){
 const directory=await mkdtemp(join(tmpdir(),'hq-mock-cli-'));const bin=join(directory,'mock-codex')
 await writeFile(bin,`#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
const args=process.argv.slice(2);let prompt='';for await(const c of process.stdin)prompt+=c;
if(!args.includes('--ignore-user-config')||!args.includes('--strict-config')||!args.includes('gpt-6.1-sol')||!args.includes('model_reasoning_effort="medium"')||process.env.HQ_WORKER_PASSWORD||process.env.OPENAI_API_KEY||process.env.HQ_BRAIN_GOOGLE_PRIVATE_KEY) {process.stdout.write(JSON.stringify({type:'error',message:'boundary-failed'})+'\\n');process.exit(1)}
if(!prompt.includes('profile_source_1')||!prompt.includes('untrusted data'))process.exit(1);
if(${JSON.stringify(meeting)}&&(!args.includes('web_search="disabled"')||args[args.indexOf('--sandbox')+1]!=='read-only'||!args.includes('mcp_servers={}')||!args.includes('shell_tool')||!args.includes('browser_use')||!prompt.includes('actual named employee Noah (AG-HR-002)')||!prompt.includes('conversation from supplied context only')||prompt.includes('You are Steve, the CEO')))process.exit(1);
const values=${JSON.stringify(events)};for(const event of values){const bytes=Buffer.from(JSON.stringify(event)+'\\n');for(let i=0;i<bytes.length;i+=7)process.stdout.write(bytes.subarray(i,i+7));}
`,{mode:0o700})
 try{return await action({bin})}finally{await rm(directory,{recursive:true,force:true})}
}
const successful=[{type:'thread.started'},{type:'turn.started'},{type:'item.completed',item:{type:'agent_message',text:'Useful draft. عمل حقيقي'}},{type:'turn.completed'}]
test('fresh bound role/model instructions; invalid modes and CEO without actual HR assessment fail closed',()=>{
 assert.equal(validateJob(job()).context.agent.effort,'medium');assert.equal(webAllowed(job()),false);assert.equal(webAllowed(job('AG-EMAIL-001')),false)
 assert.equal(webAllowed(qualifiedResearchJob()),true);assert.equal(webAllowed(job('AG-RES-001')),false)
 assert.throws(()=>validateJob(job('AG-CEO-001','conversation-ceo')),/hr-review-required/)
 assert.throws(()=>validateJob(job('AG-RES-001','unknown-stage')),/invalid-job-role/)
 const invalid=job();invalid.context.agent.model='external-paid-provider';assert.throws(()=>validateJob(invalid),/invalid-job-role/)
 assert.match(stageInstructions(job('AG-CEO-001','ceo-review')),/artifactDigest/)
})

test('head roles never execute task work; T1 execution requires a current qualification bound to its profile and skills',()=>{
 const head=job('AG-SOC-001');head.context.agent.lifecycle='Qualified';head.context.agent.skillFileIds=['skill_file_01']
 assert.equal(workerExecutionBlock(head),'staffing-required')
 const worker=job('AG-HR-002');worker.context.agent.lifecycle='Configured; trial pending';worker.context.agent.skillFileIds=['skill_file_02']
 assert.equal(workerExecutionBlock(worker),'staffing-required')
 worker.context.agent.lifecycle='Qualified'
 worker.context.agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'a'.repeat(64),evidenceId:'evidence_file_02',profileFileId:worker.context.agent.profileFileId,skillFileIds:['skill_file_02'],modelTier:'T1_WORKER',managerId:'AG-HR-001',departmentKey:'hr-agent-development'}
 assert.equal(workerExecutionBlock(worker),'staffing-required')
 worker.context.agent.headAuthorization=true
 assert.equal(workerExecutionBlock(worker),null)
 worker.context.agent.qualification.skillFileIds=['other_skill']
 assert.equal(workerExecutionBlock(worker),'staffing-required')
 const managerStart=job('AG-RES-001','task-start')
 assert.equal(workerExecutionBlock(managerStart),'staffing-required')
})
test('only an exact, live synthetic trial grant permits the isolated T1 trial stages',()=>{
 const worker=job('AG-HR-002','worker-trial'),taskId=randomUUID()
 worker.context.task={id:taskId};worker.context.agent.lifecycle='Configured; supervised trial pending'
 worker.context.agent.skillFileIds=['skill_file_02'];worker.context.agent.headAuthorization=true
 worker.context.supervisedTrial={id:randomUUID(),taskId,agentId:'AG-HR-002',managerId:'AG-HR-001',skillFileId:'skill_file_02',
   bindingDigest:'a'.repeat(64),scope:'synthetic-internal-trial-v1',status:'active',expiresAt:new Date(Date.now()+60_000).toISOString(),
   externalActionsAllowed:false,publishingAllowed:false}
 assert.equal(workerExecutionBlock(worker),null);assert.equal(webAllowed(worker),false)
 const reviewer={...worker,agent_id:'AG-HR-003',context:{...worker.context,mode:'ceo-review',trialReview:true,
   agent:{...worker.context.agent,id:'AG-HR-003'},artifact:{id:randomUUID(),digest:'b'.repeat(64),text:'trial'}}}
 validateJob(reviewer)
 worker.context.supervisedTrial.externalActionsAllowed=true;assert.equal(workerExecutionBlock(worker),'trial-authorization-required')
 worker.context.supervisedTrial.externalActionsAllowed=false;worker.context.supervisedTrial.agentId='AG-SOC-002';assert.equal(workerExecutionBlock(worker),'trial-authorization-required')
 worker.context.supervisedTrial.agentId='AG-HR-002';worker.context.supervisedTrial.expiresAt=new Date(Date.now()-1).toISOString()
 assert.equal(workerExecutionBlock(worker),'trial-authorization-required')
})
test('partial UTF8 JSONL preserves real final text and observed native search evidence',async()=>{
 const events=[...successful.slice(0,2),{type:'item.completed',item:{type:'web_search',action:{type:'open_page',url:'https://example.com/evidence'}}},...successful.slice(2)]
 const reply=await fake(events,config=>invokeCodex(config,qualifiedResearchJob(),[{id:'profile_source_1',text:'Role profile'}],AbortSignal.timeout(5000)))
 assert.match(reply.reply,/عمل حقيقي/);assert.doesNotMatch(reply.reply,/Observed web sources/);assert.equal(reply.evidence[0].sources[0].url,'https://example.com/evidence')
})
test('disabled search/tool/error outputs and incomplete turns cannot masquerade as completion',async()=>{
 for(const [item,expected] of [[{type:'command_execution',command:'ignored'},/provider-tool-rejected/],[{type:'error',message:'untrusted raw provider text'},/provider-error/],[{type:'web_search'},/provider-tool-rejected/]]){
  await fake([{type:'turn.started'},{type:'item.completed',item},{type:'turn.completed'}],config=>assert.rejects(()=>invokeCodex(config,job('AG-EMAIL-001'),[],AbortSignal.timeout(5000)),expected))
 }
 await fake(successful.filter(x=>x.type!=='turn.completed'),config=>assert.rejects(()=>invokeCodex(config,job(),[],AbortSignal.timeout(5000)),/provider-output-invalid/))
})
test('wire projection accepts v1 and bounded v2 while rejecting leaked authority or unsafe publication links',()=>{
 const snapshot={agents:[],messages:[],jobs:[],runtime:{connected:false,lastSeenAt:null},conversationId:null}
 assert.ok(parseHqAgentSnapshot(snapshot));assert.ok(parseHqAgentSnapshot({...snapshot,version:2,tasks:[],lessons:[]}))
 assert.equal(parseHqAgentSnapshot({...snapshot,workerId:randomUUID()}),null)
 const lesson={id:randomUUID(),sourceType:'task',sourceId:randomUUID(),status:'published',summary:'Verified lesson',body:'Concrete sourced lesson.',agentId:'AG-HR-001',createdAt:new Date().toISOString(),reviewedAt:new Date().toISOString(),publishedAt:new Date().toISOString(),publicationReference:'javascript:alert(1)'}
 assert.equal(parseHqAgentSnapshot({...snapshot,version:2,lessons:[lesson]}),null)
 lesson.publicationReference='https://drive.google.com/file/d/learning_output_file/view'
 assert.ok(parseHqAgentSnapshot({...snapshot,version:2,lessons:[lesson]}))
})

test('native receipts redact credentials, preserve available excerpts and never inflate the author draft',async()=>{
 const item={id:'web_7',type:'web_search',action:{type:'search',queries:['public research Bearer fixture-secret']},results:[{url:'https://example.com/doc?api_key=fixture-secret&page=1',title:'Primary doc',snippet:'Observed excerpt with sk-abcdefghijklmnopqrstuv secret.'}],urls:['https://example.com/other']}
 const receipt=nativeToolReceipt(item)
 assert.equal(receipt.sources[0].url,'https://example.com/doc?page=1');assert.match(receipt.sources[0].excerpt,/\[redacted\]/);assert.doesNotMatch(JSON.stringify(receipt),/fixture-secret|sk-abcdefghijklmnopqrstuv/)
 assert.ok(receipt.sources.some(x=>x.url==='https://example.com/other'));assert.equal(receipt.action,'search')
 const output=await fake([...successful.slice(0,2),{type:'item.completed',item},...successful.slice(2)],config=>invokeCodex(config,qualifiedResearchJob(),[],AbortSignal.timeout(5000)))
 assert.equal(output.reply,'Useful draft. عمل حقيقي');assert.equal(output.evidence.length,1);assert.equal(output.evidence[0].eventId,'web_7')
 assert.match(stageInstructions(job('AG-HR-001','lesson-extract')),/never turn them into standing company mandates/)
})

test('provider JSONL errors expose only fixed safe quota/capacity/auth/context codes',async()=>{
 const cases=[['usage_limit_reached','provider-quota'],['rate_limit_exceeded','provider-capacity'],['authentication_error','provider-auth'],['context_length_exceeded','provider-context'],['an unclassified failure','provider-error']]
 for(const [message,expected] of cases){
  assert.equal(providerErrorCode({error:{message}}),expected)
  await fake([{type:'turn.started'},{type:'turn.failed',error:{message}}],config=>assert.rejects(()=>invokeCodex(config,job(),[],AbortSignal.timeout(5000)),error=>error.message===expected))
 }
 assert.equal(codeOf(Object.assign(new Error('private provider detail'),{code:'learning-cas-required'})),'learning-cas-required')
 assert.equal(codeOf(Object.assign(new Error('private provider detail'),{code:'learning-private-token-value'})),'worker-unavailable')
})


test('CEO intake and actual task author report preserve role boundaries; chat metadata is strictly bounded',()=>{
 assert.equal(validateJob(job('AG-CEO-001','conversation-intake')).context.mode,'conversation-intake')
 assert.throws(()=>validateJob(job('AG-RES-001','conversation-intake')),/invalid-job-role/)
 const report=job('AG-RES-001','task-report');report.context.assignee={id:'AG-RES-001'};report.context.artifact={id:randomUUID(),digest:'a'.repeat(64),text:'Actual reviewed artifact'}
 assert.equal(validateJob(report).agent_id,'AG-RES-001');report.context.assignee.id='AG-HR-002';assert.throws(()=>validateJob(report),/invalid-job-role/)
 assert.match(stageInstructions(job('AG-CEO-001','conversation-intake')),/Do not silently substitute a draft/)
 assert.match(stageInstructions(job('AG-HR-001','task-ack')),/direct reports/)
 assert.match(stageInstructions(job('AG-HR-002','task-start')),/Do not claim completion/)
 const now=new Date().toISOString(),messageId=randomUUID(),conversationId=randomUUID()
 const snapshot={agents:[{id:'AG-CEO-001',name:'Steve',role:'CEO',departmentId:null,deskIndex:0,status:'offline',taskId:null,lastSeenAt:null}],messages:[{id:randomUUID(),role:'assistant',agentId:'AG-CEO-001',text:'A real handoff',createdAt:now,replyTo:messageId,kind:'handoff',taskId:randomUUID(),mentions:[{agentId:'AG-CEO-001',name:'Steve'}]}],jobs:[],runtime:{connected:false,lastSeenAt:null},conversationId}
 assert.ok(parseHqAgentSnapshot(snapshot));snapshot.messages[0].mentions[0].agentId='AG-FAKE-999';assert.equal(parseHqAgentSnapshot(snapshot),null)
 snapshot.messages[0].mentions=[];snapshot.messages[0].workerId=randomUUID();assert.equal(parseHqAgentSnapshot(snapshot),null)
})

const meetingJob=(id='AG-HR-002')=>{
 const value=job(id,'conversation-intake')
 value.context.agent.name=id==='AG-HR-002'?'Noah':id==='AG-RES-001'?'Nadia':'Actual employee'
 value.context.meetingResponse={protocol:1,scope:'conversation-only',meetingId:randomUUID(),contributionId:randomUUID(),generation:2,agentId:id,bindingDigest:'a'.repeat(64)}
 return value
}

test('versioned meeting intake uses the actual employee binding and never grants research tools',()=>{
 for(const id of ['AG-HR-001','AG-HR-002','AG-RES-001','AG-EMAIL-001']){
  const value=meetingJob(id),agent=structuredClone(value.context.agent)
  assert.equal(validateJob(value).agent_id,id)
  assert.deepEqual(value.context.agent,agent)
  assert.equal(webAllowed(value),false)
  assert.match(stageInstructions(value),new RegExp(id))
  assert.match(stageInstructions(value),/"task":null/)
  assert.match(stageInstructions(value),/Configuration does not establish research qualification/)
  assert.doesNotMatch(stageInstructions(value),/You are Steve/)
 }
 assert.equal(validateJob(job('AG-CEO-001','conversation-intake')).agent_id,'AG-CEO-001')
 assert.throws(()=>validateJob(job('AG-HR-002','conversation-intake')),/invalid-job-role/)
 assert.equal(webAllowed(job('AG-HR-002','task-work')),false)
 assert.equal(webAllowed(job('AG-RES-001','task-work')),false)
 const id=randomUUID()
 assert.deepEqual(workerClaimInput(id),{p_worker_id:id,p_lease_seconds:300,p_meeting_protocol:1})
 assert.throws(()=>workerClaimInput('invalid-worker'),/stable-worker-id-required/)
})

test('malformed or mismatched meeting markers cannot widen actor, mode or tool authority',()=>{
 const changes=[{protocol:0},{protocol:2},{scope:'research'},{generation:-1},{generation:1.1},{generation:'2'},{generation:Number.MAX_SAFE_INTEGER+1},
  {meetingId:'not-a-uuid'},{contributionId:null},{agentId:'AG-CEO-001'},{bindingDigest:'A'.repeat(64)},{bindingDigest:null},{extra:true}]
 for(const change of changes){
  const value=meetingJob();Object.assign(value.context.meetingResponse,change)
  assert.equal(webAllowed(value),false)
  assert.throws(()=>validateJob(value),/invalid-meeting-response/)
 }
 for(const key of Object.keys(meetingJob().context.meetingResponse)){
  const value=meetingJob();delete value.context.meetingResponse[key]
  assert.throws(()=>validateJob(value),/invalid-meeting-response/)
 }
 const wrongMode=meetingJob();wrongMode.context.mode='task-work'
 assert.equal(webAllowed(wrongMode),false)
 assert.throws(()=>validateJob(wrongMode),/invalid-meeting-response/)
 const nullMarker=meetingJob();nullMarker.context.meetingResponse=null
 assert.equal(webAllowed(nullMarker),false)
 assert.throws(()=>validateJob(nullMarker),/invalid-meeting-response/)
 const mismatchedProfile=meetingJob();mismatchedProfile.context.agent.id='AG-HR-001'
 assert.throws(()=>validateJob(mismatchedProfile),/invalid-job-role/)
})

test('meeting provider invocation stays context-only and rejects native web events',async()=>{
 const answer=JSON.stringify({message:'[SYNTHETIC] Actual Noah conversation fixture',task:null})
 const events=[{type:'thread.started'},{type:'turn.started'},{type:'item.completed',item:{type:'agent_message',text:answer}},{type:'turn.completed'}]
 const value=validateJob(meetingJob())
 const result=await fake(events,config=>invokeCodex(config,value,[{id:'profile_source_1',text:'Actual Noah role fixture'}],AbortSignal.timeout(5000)),{meeting:true})
 assert.equal(result.reply,answer);assert.deepEqual(result.evidence,[])
 const searched=[...events.slice(0,2),{type:'item.completed',item:{type:'web_search',action:{type:'search',queries:['must not run']}}},...events.slice(2)]
 await fake(searched,config=>assert.rejects(()=>invokeCodex(config,value,[],AbortSignal.timeout(5000)),/provider-tool-rejected/),{meeting:true})
})


/** Full synthetic Drive documents, never a network or private Brain read. */
async function withBrainFixture(documents,action,{chunked=false,changed=false,outside=false}={}) {
 const prior=globalThis.fetch,root='synthetic_brain_root_001',folder='synthetic_company_folder_001'
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048})
 const config={brainRoot:root,googleEmail:'fixture@example.invalid',googleKey:privateKey.export({type:'pkcs8',format:'pem'})}
 const reads=new Map(),calls={media:0,token:0}
 globalThis.fetch=async input=>{
  const url=String(input)
  if(url==='https://oauth2.googleapis.com/token'){calls.token++;return Response.json({access_token:'synthetic-only-token',expires_in:3600})}
  const id=url.split('/files/')[1]?.split(/[/?]/)[0]
  if(url.includes('alt=media')){
   calls.media++;const text=documents.get(id);assert.equal(typeof text,'string')
   if(!chunked)return new Response(text,{headers:{'content-length':String(Buffer.byteLength(text))}})
   const bytes=Buffer.from(text)
   return new Response(new ReadableStream({start(controller){for(let at=0;at<bytes.length;at+=4093)controller.enqueue(bytes.subarray(at,at+4093));controller.close()}}))
  }
  const count=(reads.get(id)||0)+1;reads.set(id,count)
  return Response.json({id,name:id===root?'Company Brain':id===folder?'Company':'Current Working Agreement.md',mimeType:[root,folder].includes(id)?'application/vnd.google-apps.folder':'text/markdown',parents:id===root?[]:id===folder?(outside?[]:[root]):[folder],trashed:false,modifiedTime:'2026-11-05T00:00:00Z',version:changed&&documents.has(id)&&count>1?'2':'1'})
 }
 try{return await action(brainReader(config),calls)}finally{globalThis.fetch=prior}
}
const mandatoryAgreementId='1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf'
const brainContext=ids=>({brain_files:ids.map(id=>({id}))})

test('full 50KB mandatory working agreement reaches inference context without truncation',async()=>{
 const header='# Current Working Agreement\n\n## CEO-first Chat\nStanding authority, review and evidence rules apply.\n'
 const text=header+'Approved process remains scoped and source-backed.\n'.repeat(1100)
 assert.ok(Buffer.byteLength(text)>50_000&&Buffer.byteLength(text)<128_000)
 await withBrainFixture(new Map([[mandatoryAgreementId,text]]),async(reader,calls)=>{
  const result=await reader(brainContext([mandatoryAgreementId]),AbortSignal.timeout(5000))
  assert.equal(result.length,1);assert.equal(result[0].text,text);assert.equal(result[0].revision,'1');assert.equal(calls.media,1)
 })
})

test('per-source 128000-byte boundary is enforced for declared and chunked UTF8 responses',async()=>{
 for(const chunked of [false,true])for(const bytes of [128_000,128_001]){
  // A multibyte prefix ensures the boundary counts bytes, not JS characters.
  const text='العربية'+ 'x'.repeat(bytes-Buffer.byteLength('العربية'))
  let inferenceCalls=0
  await withBrainFixture(new Map([[mandatoryAgreementId,text]]),async(reader)=>{
   const load=async()=>{const result=await reader(brainContext([mandatoryAgreementId]),AbortSignal.timeout(5000));inferenceCalls++;return result}
   if(bytes===128_000){assert.equal((await load())[0].text,text);assert.equal(inferenceCalls,1)}
   else{await assert.rejects(load,error=>error.code==='brain-source-too-large');assert.equal(inferenceCalls,0)}
  },{chunked})
 }
})

test('aggregate Brain context retains exact 250000-byte ceiling before inference',async()=>{
 for(const bytes of [250_000,250_001]){
  const documents=new Map([[mandatoryAgreementId,'a'.repeat(128_000)],['synthetic_other_rule_001','b'.repeat(bytes-128_000)]])
  let inferenceCalls=0
  await withBrainFixture(documents,async(reader,calls)=>{
   const load=async()=>{const result=await reader(brainContext([...documents.keys()]),AbortSignal.timeout(5000));inferenceCalls++;return result}
   if(bytes===250_000){const result=await load();assert.equal(result.reduce((sum,item)=>sum+Buffer.byteLength(item.text),0),250_000);assert.equal(inferenceCalls,1)}
   else{await assert.rejects(load,error=>error.code==='brain-context-too-large');assert.equal(inferenceCalls,0)}
   assert.equal(calls.media,2)
  },{chunked:true})
 }
})

test('larger allowed documents retain source count, root ancestry and exact revision fences',async()=>{
 const documents=new Map([[mandatoryAgreementId,'a'.repeat(50_435)]])
 await withBrainFixture(documents,async(reader,calls)=>{
  await assert.rejects(()=>reader(brainContext(Array.from({length:19},(_,i)=>'synthetic_rule_'+i)),AbortSignal.timeout(5000)),error=>error.code==='brain-scope-required');assert.equal(calls.token,0)
 })
 await withBrainFixture(documents,async(reader,calls)=>{
  await assert.rejects(()=>reader(brainContext([mandatoryAgreementId]),AbortSignal.timeout(5000)),error=>error.code==='brain-source-outside-root');assert.equal(calls.media,0)
 },{outside:true})
 await withBrainFixture(documents,async(reader)=>{
  await assert.rejects(()=>reader(brainContext([mandatoryAgreementId]),AbortSignal.timeout(5000)),error=>error.code==='brain-source-changed')
 },{changed:true})
})
