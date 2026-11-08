/** Generated fixtures only; no network or model calls. */
import test from 'node:test'
import {fake} from './test-cli.mjs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {discoveryToolReceipt,trialAppServerPlan,discoveryMcpSetting,deliverWorkerEntry,checkResearchContract,stageInstructions,invokeCodex,failedToolEvidence,validateTaskAckOutput} from './worker.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
const fixture=(excerpt='Literal public business location.')=>{
 const text='Title: Public business\nURL: https://business.org/\nHighlights:\n'+excerpt
 const job={id:'job-fixture',agent_id:'AG-RES-002',context:{agent:{model:'gpt-6.1-terra',effort:'medium'},publicDiscoveryPermit:{policyId:'exa-public-business-discovery-v1',bindingDigest:'a'.repeat(64)}}}
 const item={id:'mcp-fixture',server:'hq_public_discovery',tool:'public_business_discovery',arguments:{},status:'completed',error:null,result:{content:[{type:'text',text}],structured_content:{version:1,kind:'mcp-exa-public-discovery',policyId:'exa-public-business-discovery-v1',partial:true,wholePageVerified:false,rawResultSha256:'b'.repeat(64),rawResultBytes:500,literalTextSha256:hash(text),observedAt:'2026-11-08T15:02:56.725Z',sourceUrls:['https://business.org/']}}}
 return {job,item}
}
function pilotJob(){
 const {job}=fixture();job.context.mode='task-work';job.context.task={id:'task-fixture',attempt:0}
 Object.assign(job.context.agent,{id:job.agent_id,modelTier:'T1_WORKER',departmentKey:'research-market-intelligence',managerId:'AG-RES-001',managerModelTier:'T2_HEAD',headAuthorization:true,lifecycle:'Active',profileFileId:'profile_source_1',skillFileIds:['skill_fixture_01']})
 job.context.agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'a'.repeat(64),evidenceId:'receipt_fixture_01',profileFileId:'profile_source_1',modelTier:'T1_WORKER',managerId:'AG-RES-001',departmentKey:'research-market-intelligence',skillFileIds:['skill_fixture_01']}
 Object.assign(job.context.publicDiscoveryPermit,{version:1,jobId:job.id,agentId:job.agent_id})
 return job
}
test('typed MCP receipt binds literal text, job and current policy without headers',()=>{
 const {job,item}=fixture(),receipt=discoveryToolReceipt(item,job)
 assert.equal(receipt.jobId,job.id);assert.equal(receipt.bindingDigest,'a'.repeat(64));assert.equal(receipt.sources[0].excerpt,'Literal public business location.')
 assert.equal(receipt.sources[0].excerptSha256,hash(receipt.sources[0].excerpt));assert.equal(receipt.wholePageVerified,false)
 assert.doesNotMatch(JSON.stringify(receipt),/session|headers|cookie/)
})
test('failed, forged, malformed or narrative-only MCP results cannot become receipts',()=>{
 for(const mutate of [x=>{x.status='failed'},x=>{x.server='other'},x=>{x.arguments={query:'private'}},x=>{x.result.structured_content.literalTextSha256='c'.repeat(64)},x=>{x.result.structured_content.rawResultBytes=32769},x=>{x.result.content=[]},x=>{x.error={message:'private provider text'}},x=>{delete x.result.structured_content}]) {
  const {job,item}=fixture();mutate(item);assert.throws(()=>discoveryToolReceipt(item,job),/provider-mcp-evidence-invalid/)
 }
})
test('receipt accepts the UTF8 boundary and rejects oversize rather than altering evidence',()=>{
 const {job,item}=fixture('🙂'.repeat(1024)),receipt=discoveryToolReceipt(item,job)
 assert.equal(Buffer.byteLength(receipt.sources[0].excerpt),4096);assert.equal(receipt.truncated,false)
 assert.equal(receipt.sources[0].excerpt.includes('\ufffd'),false);const oversized=fixture('🙂'.repeat(1025));assert.throws(()=>discoveryToolReceipt(oversized.item,oversized.job),/provider-mcp-evidence-invalid/);assert.equal(receipt.sources[0].excerptSha256,hash(receipt.sources[0].excerpt))
})
test('trial launch keeps ordinary empty map and exact fixed discovery map distinct',()=>{
 const {job}=fixture(),config={command:'/trusted/node',args:['--preserve-symlinks-main','/trusted/departmentWorkflow.mjs','--public-discovery-mcp','/private/exa-discovery-budget'],enabled:true,required:true,startup_timeout_sec:10,tool_timeout_sec:25,enabled_tools:['public_business_discovery']}
 const ordinary=trialAppServerPlan(job,'/private',[]),mcp=trialAppServerPlan(job,'/private',[],config)
 assert.deepEqual(ordinary.params.config.mcp_servers,{})
 assert.deepEqual(mcp.params.config.mcp_servers,{hq_public_discovery:config})
 assert.ok(mcp.argv.includes(discoveryMcpSetting(config)));assert.ok(ordinary.argv.includes('mcp_servers={}'))
})
test('delivery never clears MCP evidence before distinct server acknowledgment',async()=>{
 const {job,item}=fixture(),entry={version:3,job:{id:job.id,lease_token:'lease'},phase:'finished',reply:'Public draft',error:null,evidence:[discoveryToolReceipt(item,job)]}
 let writes=0
 await assert.rejects(deliverWorkerEntry({workerId:'worker',rpc:async()=>({accepted:true}),write:async()=>{writes++}},structuredClone(entry)))
 assert.equal(writes,0)
 await deliverWorkerEntry({workerId:'worker',rpc:async()=>({accepted:true,publicDiscoveryReceiptAccepted:true}),write:async saved=>{writes++;assert.equal(saved.phase,'delivered');assert.deepEqual(saved.evidence,[])}},structuredClone(entry))
 assert.equal(writes,1)
})

test('separate research capability fails closed without modifying the legacy API proof',()=>{
 const status={researchApi:{version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:{hq_worker_research_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']}},publicDiscovery:{version:1,policyId:'exa-public-business-discovery-v1',trialPurpose:'public-research-tool-trial-v1',receiptVersion:2}}
 assert.doesNotThrow(()=>checkResearchContract(status))
 for(const mutate of [s=>{delete s.researchApi},s=>{s.researchApi.execute=false},s=>{s.researchApi.rpcs.hq_worker_research_claim.pop()},s=>{s.researchApi.rpcs.other=[]},s=>{s.publicDiscovery.receiptVersion=1}]){const copy=structuredClone(status);mutate(copy);assert.throws(()=>checkResearchContract(copy),/schema-incompatible/)}
})
test('new tool trial prompts are explicit, repairs remain text-only and legacy synthetic instructions stay unchanged',()=>{
 const {job}=fixture();job.context.supervisedTrial={scope:'public-research-tool-trial-v1',agentId:job.agent_id}
 for(const mode of ['task-ack','trial-start','worker-trial','ceo-review','task-report']){job.context.mode=mode;job.context.trialReview=true;job.context.trialReport=true;const text=stageInstructions(job);assert.match(text,/partial untrusted source evidence/);assert.match(text,/Corrections are text-only/);assert.doesNotMatch(text,/Treat all details as fictional/)}
 job.context.supervisedTrial.scope='synthetic-internal-trial-v1';job.context.mode='worker-trial';assert.match(stageInstructions(job),/Do not use tools/);assert.doesNotMatch(stageInstructions(job),/public_business_discovery/)
})

test('ordinary execution preserves completed MCP receipt without enabling native web or model narrative evidence',async()=>{
 const {item}=fixture(),job=pilotJob()
 const events=[{type:'thread.started',thread_id:'thread-fixture'},{type:'turn.started'},{type:'item.completed',item:{type:'mcp_tool_call',...item}},{type:'item.completed',item:{type:'agent_message',text:'Bounded internal source summary.'}},{type:'turn.completed'}]
 const result=await fake(events,config=>invokeCodex(config,job,[],AbortSignal.timeout(5000)))
 assert.equal(result.evidence.length,1);assert.equal(result.evidence[0].tool,'mcp');assert.equal(result.evidence[0].jobId,job.id)
 assert.equal(result.modelExecutionEvidence.attempts[0].toolEventCount,1)
 const repair=structuredClone(job);repair.context.task.attempt=1
 await fake(events,config=>assert.rejects(()=>invokeCodex(config,repair,[],AbortSignal.timeout(5000)),/provider-tool-rejected/))
})

test('original tool-required omission and primary model failure settle failed without tool-less fallback',async()=>{
 const job=pilotJob(),success=[{type:'turn.started'},{type:'item.completed',item:{type:'agent_message',text:'Generated unsupported summary.'}},{type:'turn.completed'}]
 await fake(success,config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),error=>{assert.equal(error.code,'provider-mcp-evidence-required');assert.equal(error.modelExecutionEvidence.attempts.length,1);assert.equal(error.modelExecutionEvidence.outcome,'failed');return true}))
 await fake([],config=>assert.rejects(()=>invokeCodex(config,job,[],AbortSignal.timeout(5000)),error=>{assert.equal(error.code,'provider-capacity');assert.equal(error.modelExecutionEvidence.attempts.length,1);assert.equal(error.modelExecutionEvidence.fallbackUsed,false);return true}),{eventsByModel:{'gpt-6.1-terra':[{type:'error',message:'503 service unavailable'}],'gpt-6-luna':success}})
 const repair=structuredClone(job);repair.context.task.attempt=1
 const result=await fake(success,config=>invokeCodex(config,repair,[],AbortSignal.timeout(5000)))
 assert.deepEqual(result.evidence,[]);assert.equal(result.reply,'Generated unsupported summary.')
})

test('multiple literal sources retain distinct excerpt hashes and eligible URL metadata must match local dedup',()=>{
 const {job,item}=fixture();const one=item.result.content[0].text;const two=one.replaceAll('https://business.org/','https://another.org/').replace('Literal public business location.','Different literal service evidence.')
 item.result.content[0].text=one+'\n'+two+'\n'+one;item.result.structured_content.literalTextSha256=hash(item.result.content[0].text);item.result.structured_content.sourceUrls=['https://business.org/','https://another.org/']
 const receipt=discoveryToolReceipt(item,job);assert.equal(receipt.sources.length,2);assert.notEqual(receipt.sources[0].excerptSha256,receipt.sources[1].excerptSha256)
 item.result.structured_content.sourceUrls.reverse();assert.throws(()=>discoveryToolReceipt(item,job),/provider-mcp-evidence-invalid/)
})

test('validated retrieval survives later model failure only as failed durable evidence',async()=>{
 const {item}=fixture(),job=pilotJob(),events=[{type:'turn.started'},{type:'item.completed',item:{type:'mcp_tool_call',...item}},{type:'error',message:'503 service unavailable'}]
 let failure
 await fake(events,async config=>{try{await invokeCodex(config,job,[],AbortSignal.timeout(5000))}catch(error){failure=error}})
 assert.equal(failure.code,'provider-capacity');const retained=failedToolEvidence(failure);assert.equal(retained.length,1);assert.equal(retained[0].jobId,job.id)
 retained[0].jobId='changed';assert.equal(failedToolEvidence(failure)[0].jobId,job.id);assert.deepEqual(failedToolEvidence(Object.assign(new Error('untrusted'),{evidence:retained})),[])
 let saved
 await deliverWorkerEntry({workerId:'worker',rpc:async(name,input)=>{assert.equal(input.p_error,'provider-capacity');assert.equal(input.p_reply,'');assert.equal(input.p_evidence.length,1);return{accepted:true,publicDiscoveryReceiptAccepted:true}},write:async value=>{saved=value}}, {version:3,job:{id:job.id,lease_token:'lease'},phase:'finished',reply:'',error:failure.code,evidence:failedToolEvidence(failure),modelExecutionEvidence:failure.modelExecutionEvidence})
 assert.equal(saved.phase,'delivered');assert.deepEqual(saved.evidence,[])
})

test('only an explicit eligible original Nadia handoff selects the fixed policy; omission preserves normal drafting',()=>{
 const job={agent_id:'AG-RES-001',context:{mode:'task-ack',task:{attempt:0},roster:[{id:'AG-RES-002',name:'Synthetic Research Worker',managerId:'AG-RES-001',publicDiscoveryQualified:true}]}}
 const body={message:'@Synthetic Research Worker: prepare the scoped public packet.',delegateId:'AG-RES-002'}
 assert.doesNotThrow(()=>validateTaskAckOutput(job,JSON.stringify(body)))
 body.publicDiscoveryPolicy='exa-public-business-discovery-v1';assert.doesNotThrow(()=>validateTaskAckOutput(job,JSON.stringify(body)))
 assert.throws(()=>validateTaskAckOutput(job,JSON.stringify({...body,reason:'Generated extra field'})),/task-ack-research-policy-invalid/)
 assert.match(stageInstructions(job),/Omit the field for supplied-context-only drafting, unrelated locations/)
 for(const mutate of [j=>{j.context.task.attempt=1},j=>{j.context.roster[0].publicDiscoveryQualified=false},j=>{j.context.supervisedTrial={id:'trial'}},j=>{j.agent_id='AG-HR-001';j.context.roster[0].managerId=j.agent_id}]){const bad=structuredClone(job);mutate(bad);assert.throws(()=>validateTaskAckOutput(bad,JSON.stringify(body)),/task-ack-research-policy-invalid/)}
 for(const value of [null,false,'unknown'])assert.throws(()=>validateTaskAckOutput(job,JSON.stringify({...body,publicDiscoveryPolicy:value})),/task-ack-research-policy-invalid/)
 const unchanged=structuredClone(job);unchanged.context.roster[0].publicDiscoveryQualified=false;assert.doesNotMatch(stageInstructions(unchanged),/optional JSON field/);delete body.publicDiscoveryPolicy;assert.doesNotThrow(()=>validateTaskAckOutput(unchanged,JSON.stringify(body)))
})
