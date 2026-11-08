/** Synthetic transport only; never contacts GitHub or a model. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fake} from './test-cli.mjs'
import {PUBLIC_REPOSITORY_MANIFEST, PUBLIC_REPOSITORY_MANIFEST_DIGEST,repositoryMcpConfig} from './departmentWorkflow.mjs'
import {repositoryToolReceipt,checkRepositoryContract,trialAppServerPlan,invokeCodex,failedToolEvidence,deliverWorkerEntry,validateTaskAckOutput,stageInstructions} from './worker.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
function fixture(){
 const selection={version:1,preset:'hq-worker-boundary-v1',mode:'snapshot',sha:'a'.repeat(40),pullRequestNumber:null}
 const agent={id:'AG-DEV-002',model:'gpt-6.1-terra',effort:'medium',modelTier:'T1_WORKER',departmentKey:'development-maintenance',managerId:'AG-DEV-001',managerModelTier:'T2_HEAD',headAuthorization:true,lifecycle:'Active',profileFileId:'profile_source_1',skillFileIds:['skill_fixture_01']}
 agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'b'.repeat(64),evidenceId:'receipt_fixture_01',profileFileId:agent.profileFileId,modelTier:agent.modelTier,managerId:agent.managerId,departmentKey:agent.departmentKey,skillFileIds:agent.skillFileIds}
 const job={id:randomUUID(),agent_id:agent.id,context:{mode:'task-work',agent,task:{id:randomUUID(),attempt:0}}}
 job.context.publicRepositoryPermit={version:1,policyId:'hq-public-github-read-v1',jobId:job.id,agentId:job.agent_id,bindingDigest:'b'.repeat(64),selection,reservationId:randomUUID(),manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,expiresAt:new Date(Date.now()+3600000).toISOString()}
 const bundle={version:1,repositoryId:1376504404,repositoryFullName:'Building-Suit/building-suit-monorepo',manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,selection,resolvedSha:selection.sha,revisionObservedAt:new Date().toISOString(),observedAt:new Date().toISOString(),requestAttempts:7,bytesRead:1000,files:PUBLIC_REPOSITORY_MANIFEST.presets[0].files.map(spec=>({path:spec.path,blobSha:'c'.repeat(40),bytes:100,sha256:'d'.repeat(64),windows:spec.windows.map(([start,end])=>({start,end,text:'Literal synthetic source evidence',sha256:hash('Literal synthetic source evidence'),truncated:false}))})),ci:{state:'not-requested',runs:[],checks:[],jobs:[],unknownReasons:[]},partial:true,authentication:'none',codeExecuted:false,writesPerformed:false,testedSourceSha:'unknown',executedByThisEmployee:false,requiredChecksVerified:false}
 const text=JSON.stringify(bundle),result={content:[{type:'text',text}],structured_content:{version:1,kind:'mcp-public-github-read',policyId:'hq-public-github-read-v1',repositoryId:1376504404,manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,selection,observedAt:bundle.observedAt,bundleSha256:hash(text),bundleBytes:Buffer.byteLength(text)}}
 return{job,item:{id:'repository_event_1',server:'hq_public_repository',tool:'read_public_repository_bundle',arguments:{},status:'completed',error:null,result}}
}
async function run(f,options={}){const state=await mkdtemp(join(tmpdir(),'hq-repository-worker-'));try{return await fake([],config=>f({...config,state}),options)}finally{await rm(state,{recursive:true,force:true})}}
const event=item=>({method:'item/completed',params:{item:{...item,type:'mcpToolCall',result:{...item.result,structuredContent:item.result.structured_content,structured_content:undefined}}}})
test('typed repository receipt retains exact text and public snapshot without claiming execution',()=>{
 const{job,item}=fixture(),receipt=repositoryToolReceipt(item,job)
 assert.equal(receipt.bundleText,item.result.content[0].text);assert.equal(receipt.bundleSha256,hash(receipt.bundleText));assert.equal(receipt.reservationId,job.context.publicRepositoryPermit.reservationId)
 assert.equal(JSON.parse(receipt.bundleText).requiredChecksVerified,false)
 for(const mutate of [x=>x.arguments={query:'private'},x=>x.server='other',x=>x.status='failed',x=>x.result.content[0].text+=' ',x=>x.result.structured_content.selection.sha='e'.repeat(40)]){const f=fixture();mutate(f.item);assert.throws(()=>repositoryToolReceipt(f.item,f.job),/provider-mcp-evidence-invalid/)}
})
test('private task and Brain canaries never enter public tool configuration',()=>{
 const{job}=fixture();job.prompt='PRIVATE_TASK_CANARY';job.context.privateBrain='PRIVATE_BRAIN_CANARY'
 const config=repositoryMcpConfig(job,{nodePath:'/trusted/node',modulePath:'/trusted/departmentWorkflow.mjs',budgetFile:'/private/public-repository-'+job.context.publicRepositoryPermit.reservationId+'.budget',executionModel:job.context.agent.model})
 assert.ok(config);assert.doesNotMatch(JSON.stringify(config),/PRIVATE_TASK_CANARY|PRIVATE_BRAIN_CANARY|profile_source_1|skill_fixture_01/)
 const encoded=config.args.at(-2);assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64url')),job.context.publicRepositoryPermit.selection)
})
test('repository API is separate from unchanged legacy role proof',()=>{
 assert.equal(checkRepositoryContract({}),false)
 const status={repositoryApi:{version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:{hq_worker_repository_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']}}}
 assert.equal(checkRepositoryContract(status),true);status.repositoryApi.rpcs.other=[];assert.throws(()=>checkRepositoryContract(status),/schema-incompatible/)
})
test('original ordinary repository execution requires returned model resolution and one real MCP event',async()=>{
 const{job,item}=fixture()
 const output=await run(config=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),{appServer:{publicRepository:true,events:[event(item)]}})
 assert.equal(output.evidence.length,1);assert.equal(output.modelBindingEvidence.trialId,null)
 assert.equal(output.modelBindingEvidence.hostResolution.model,'gpt-6.1-terra');assert.equal(output.modelBindingEvidence.hostResolution.reasoningEffort,'medium')
 assert.equal(output.modelBindingEvidence.publicRepositoryPolicy.moduleSha256.length,64);assert.equal(output.modelExecutionEvidence.attempts[0].toolEventCount,1)
 await run(config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),/provider-mcp-evidence-required/),{appServer:{publicRepository:true}})
 await run(config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),/provider-model-resolution-invalid/),{appServer:{publicRepository:true,modelMismatch:true}})
})
test('a received read survives later model failure only as failed evidence; no fallback or new read',async()=>{
 const{job,item}=fixture();let failure
 await run(async config=>{try{await invokeCodex(config,job,[],AbortSignal.timeout(5000))}catch(error){failure=error}}, {appServer:{publicRepository:true,events:[event(item)],turnStatus:'failed'}})
 assert.ok(failure);assert.equal(failedToolEvidence(failure).length,1);assert.equal(failure.modelExecutionEvidence.fallbackUsed,false)
 assert.equal(failure.modelBindingEvidence.outcome,'failed')
})
test('retrieved instructions cannot authorize shell or an unrelated MCP tool',async()=>{
 const{job}=fixture()
 for(const item of [{type:'commandExecution',id:'forged-command',command:'private command'}, {type:'mcpToolCall',id:'foreign-mcp',server:'unapproved',tool:'fetch',arguments:{url:'https://unapproved.example/'}}])
  await run(config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),/provider-tool-rejected/),{appServer:{publicRepository:true,events:[{method:'item/completed',params:{item}}]}})
})
test('a second rejected MCP event remains counted without becoming another source receipt',async()=>{
 const{job,item}=fixture(),second=structuredClone(item);second.id='repository_event_2';second.status='failed';second.error={message:'budget exhausted'}
 let failure
 await run(async config=>{try{await invokeCodex(config,job,[],AbortSignal.timeout(5000))}catch(error){failure=error}}, {appServer:{publicRepository:true,events:[event(item),event(second)]}})
 assert.equal(failure.modelExecutionEvidence.attempts[0].toolEventCount,2);assert.equal(failedToolEvidence(failure).length,1)
})
test('fixed access and rate failures survive settlement without provider text or retries',async()=>{
 for(const code of ['repository-access-denied','repository-rate-limited','repository-budget-exhausted','repository-unavailable-no-retry']){
  const{job,item}=fixture();item.result={isError:true,content:[{type:'text',text:code}]}
  await run(config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),error=>{assert.equal(error.code,code);assert.deepEqual(error.modelBindingEvidence.observedErrors,[code]);assert.equal(error.modelExecutionEvidence.fallbackUsed,false);assert.deepEqual(failedToolEvidence(error),[]);return true}),{appServer:{publicRepository:true,events:[event(item)]}})
 }
})
test('invalid original permit fails before inference; repairs expose no repository MCP',async()=>{
 const{job}=fixture();job.context.publicRepositoryPermit.expiresAt='2000-01-01T00:00:00Z'
 await run(config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),/repository-authorization-required/))
 job.context.task.attempt=1
 const plan=trialAppServerPlan(job,'/private',[],null);assert.deepEqual(plan.params.config.mcp_servers,{})
})
test('text repairs retain current returned model proof and original reservation with no MCP',async()=>{
 const{job}=fixture();job.context.task.attempt=1
 const result=await run(config=>invokeCodex(config,job,[],AbortSignal.timeout(5000)))
 assert.deepEqual(result.evidence,[]);assert.equal(result.modelBindingEvidence.publicRepositoryPolicy.reservationId,job.context.publicRepositoryPermit.reservationId)
 assert.equal(result.modelBindingEvidence.hostResolution.model,'gpt-6.1-terra');assert.equal(result.modelExecutionEvidence.attempts[0].toolEventCount,0)
 const servers=result.modelBindingEvidence.invocation.protocol.threadStart.params.config.mcp_servers;assert.deepEqual(servers,{})
})
test('ordinary durable delivery requires repository acknowledgment without pretending to be a trial',async()=>{
 const{job,item}=fixture(),receipt=repositoryToolReceipt(item,job),entry={version:3,job:{id:job.id,lease_token:randomUUID()},phase:'finished',reply:'bounded source result',error:null,evidence:[receipt],modelBindingEvidence:{schemaVersion:1,workerJobId:job.id,trialId:null,publicRepositoryPolicy:{policyId:'hq-public-github-read-v1'}}}
 let saved,calls=0
 await deliverWorkerEntry({workerId:'worker',rpc:async()=>{calls++;return{accepted:true,repositoryReceiptAccepted:true}},write:async value=>saved=value},entry)
 assert.equal(calls,1);assert.equal(saved.phase,'delivered');assert.deepEqual(saved.evidence,[])
 await assert.rejects(()=>deliverWorkerEntry({workerId:'worker',retryWait:async()=>{},rpc:async()=>({accepted:true}),write:async()=>assert.fail('unconfirmed evidence cleared')},entry),/repository-receipt-unconfirmed/)
})
test('Adam can select only a supplied original frozen bundle and reviews keep exact artifact digest',()=>{
 const bundleId=randomUUID(),job={agent_id:'AG-DEV-001',context:{mode:'task-ack',task:{attempt:0},roster:[{id:'AG-DEV-002',managerId:'AG-DEV-001',name:'Synthetic worker'}],publicRepositoryBundles:[{bundleId,agentId:'AG-DEV-002',expiresAt:new Date(Date.now()+3600000).toISOString()}]}}
 const reply=JSON.stringify({message:'@Synthetic worker inspect approved snapshot',delegateId:'AG-DEV-002',publicRepositoryBundleId:bundleId})
 validateTaskAckOutput(job,reply);assert.match(stageInstructions(job),/publicRepositoryBundleId/)
 job.context.task.attempt=1;assert.throws(()=>validateTaskAckOutput(job,reply),/task-ack-repository-policy-invalid/)
 job.context.mode='ceo-review';job.context.supervisedTrial={scope:'public-repository-read-trial-v1'};assert.match(stageInstructions(job),/artifactDigest/);assert.match(stageInstructions(job),/summary/)
})
