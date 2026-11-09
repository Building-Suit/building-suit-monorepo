/** Generated fixtures only; no network or model calls. */
import test from 'node:test'
import {fake} from './test-cli.mjs'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {discoveryToolReceipt,trialAppServerPlan,discoveryMcpSetting,deliverWorkerEntry,checkResearchContract,checkRoleContract,stageInstructions,invokeCodex,failedToolEvidence,validateTaskAckOutput} from './worker.mjs'
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

const retailPolicy='exa-public-retail-discovery-v1'
for(const category of ['clothing','footwear','homewares'])test(`retail receipt ${category} preserves literal evidence and binds fixed category`,()=>{
 const {job,item}=fixture();Object.assign(job.context.publicDiscoveryPermit,{policyId:retailPolicy,category})
 Object.assign(item.result.structured_content,{policyId:retailPolicy,category})
 const receipt=discoveryToolReceipt(item,job);assert.equal(receipt.policyId,retailPolicy);assert.equal(receipt.queryId,`new-cairo-retail-${category}-v1`)
 assert.equal(receipt.sources[0].excerpt,'Literal public business location.');assert.equal(Object.keys(receipt).length,18)
 item.result.structured_content.category='another-category';assert.throws(()=>discoveryToolReceipt(item,job),/provider-mcp-evidence-invalid/)
})
test('retail head selection is original, qualified and finite; absent selection preserves supplied-context work',()=>{
 const job={agent_id:'AG-RES-001',context:{mode:'task-ack',task:{attempt:0},roster:[{id:'AG-RES-002',name:'Generated worker',managerId:'AG-RES-001',publicRetailQualified:true}]}}
 const base={message:'@Generated worker: prepare the approved internal packet.',delegateId:'AG-RES-002'}
 assert.doesNotThrow(()=>validateTaskAckOutput(job,JSON.stringify(base)))
 for(const category of ['clothing','footwear','homewares'])assert.doesNotThrow(()=>validateTaskAckOutput(job,JSON.stringify({...base,publicDiscoveryPolicy:retailPolicy,publicDiscoveryCategory:category})))
 for(const category of [null,['clothing'],'pharmacy','private task text'])assert.throws(()=>validateTaskAckOutput(job,JSON.stringify({...base,publicDiscoveryPolicy:retailPolicy,publicDiscoveryCategory:category})),/task-ack-research-policy-invalid/)
 assert.throws(()=>validateTaskAckOutput(job,JSON.stringify({...base,publicDiscoveryCategory:'clothing'})),/task-ack-research-policy-invalid/)
 const copy=structuredClone(job);copy.context.task.attempt=1
 assert.throws(()=>validateTaskAckOutput(copy,JSON.stringify({...base,publicDiscoveryPolicy:retailPolicy,publicDiscoveryCategory:'clothing'})),/task-ack-research-policy-invalid/)
 assert.match(stageInstructions(job),/finite public retail/);assert.match(stageInstructions(job),/never your task text/)
})
test('role claim proof is optional before rollout and strict when advertised',()=>{
 assert.equal(checkRoleContract({}),false)
 const status={roleApi:{version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:{hq_worker_role_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']}}}
 assert.equal(checkRoleContract(status),true)
 for(const change of [s=>{s.roleApi.execute=false},s=>{s.roleApi.rpcs.hq_worker_role_claim.pop()},s=>{s.roleApi.rpcs.other=[]}]){const bad=structuredClone(status);change(bad);assert.throws(()=>checkRoleContract(bad),/schema-incompatible/)}
})
test('evaluator stages retain complete fixed fixture packet and identify the bound senior reviewer',()=>{
 const {job}=fixture();job.context.agent.name='Generated senior reviewer';job.context.supervisedTrial={scope:'evaluator-skill-trial-v1',agentId:'AG-HR-003',reviewerId:'AG-CEO-001'}
 for(const mode of ['task-ack','trial-start','worker-trial','ceo-review','task-report']){
  job.context.mode=mode;job.context.trialReview=true;job.context.trialReport=true
  const text=stageInstructions(job);assert.match(text,/context.trialAssignment/);assert.match(text,/do not invent substitute cases/);assert.doesNotMatch(text,/recorded head\/Iris/)
  if(mode==='ceo-review')assert.match(text,/As Generated senior reviewer/)
 }
})
test('actual retail CLI plan returns real module declaration and retains it through acknowledged journal cleanup',async()=>{
 const job=pilotJob(),{item}=fixture(),category='clothing';job.context.mode='worker-trial'
 Object.assign(job.context.publicDiscoveryPermit,{policyId:retailPolicy,category})
 job.context.supervisedTrial={id:randomUUID(),taskId:job.context.task.id,agentId:job.agent_id,managerId:'AG-RES-001',skillFileId:'skill_fixture_01',
  scope:'public-retail-tool-trial-v1',toolPolicyId:retailPolicy,category,status:'active',bindingDigest:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),externalActionsAllowed:false,publishingAllowed:false}
 Object.assign(item.result.structured_content,{policyId:retailPolicy,category})
 const appItem={...item,type:'mcpToolCall',result:{content:item.result.content,structuredContent:item.result.structured_content}}
 const output=await fake([],config=>invokeCodex({...config,id:'generated-worker'},job,[],AbortSignal.timeout(5000)),
  {cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,publicDiscoveryCategory:category,events:[{method:'item/completed',params:{item:appItem}}],turnItems:[appItem]}})
 const policy=output.modelBindingEvidence.publicDiscoveryPolicy
 assert.equal(policy.policyId,retailPolicy);assert.equal(policy.category,category)
 assert.equal(policy.moduleSha256,hash(await readFile(new URL('./departmentWorkflow.mjs',import.meta.url))))
 assert.equal(output.evidence[0].queryId,'new-cairo-retail-clothing-v1')
 let saved
 await deliverWorkerEntry({workerId:'generated-worker',rpc:async()=>({accepted:true,trialReceiptAccepted:true,publicDiscoveryReceiptAccepted:true}),write:async entry=>{saved=entry}},
  {version:3,job:{id:job.id,lease_token:'generated-lease'},phase:'finished',reply:output.reply,error:null,evidence:output.evidence,modelBindingEvidence:output.modelBindingEvidence})
 assert.equal(saved.phase,'delivered');assert.deepEqual(saved.modelBindingEvidence.publicDiscoveryPolicy,policy)
})

const discoveryFailures=['discovery-access-denied','discovery-rate-limited','discovery-response-too-large','discovery-dns-rejected','discovery-source-unavailable','discovery-result-invalid','discovery-budget-exhausted','discovery-unavailable-no-retry']
function retailFailure(category='clothing',code=discoveryFailures[0],trial=false){
 const job=pilotJob(),{item}=fixture()
 Object.assign(job.context.publicDiscoveryPermit,{policyId:retailPolicy,category})
 if(trial){
  job.context.mode='worker-trial'
  job.context.supervisedTrial={id:randomUUID(),taskId:job.context.task.id,agentId:job.agent_id,managerId:'AG-RES-001',skillFileId:'skill_fixture_01',scope:'public-retail-tool-trial-v1',toolPolicyId:retailPolicy,category,status:'active',bindingDigest:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),externalActionsAllowed:false,publishingAllowed:false}
 }
 item.result={isError:true,content:[{type:'text',text:code}]}
 return {job,item}
}
async function invokeFailure(protocol,job,items){
 const appItems=items.map(item=>({...item,type:'mcpToolCall'}))
 const events=[{type:'turn.started'},...items.map(item=>({type:'item.completed',item:{...item,type:'mcp_tool_call'}})),{type:'item.completed',item:{type:'agent_message',text:'Must not turn a failed retrieval into a successful draft.'}},{type:'turn.completed'}]
 let failure
 await fake(events,async config=>{
  try{await invokeCodex({...config,id:'generated-worker'},job,[],AbortSignal.timeout(5000))}catch(error){failure=error}
 },protocol==='app-server'?{cliVersion:'codex-cli 0.160.0',appServer:{publicDiscovery:true,publicDiscoveryCategory:job.context.publicDiscoveryPermit.category,events:appItems.map(item=>({method:'item/completed',params:{item}})),turnItems:appItems}}:{})
 assert.ok(failure,'a failed retrieval must reject execution')
 return failure
}
for(const category of ['clothing','footwear','homewares'])for(const code of discoveryFailures){
 test(`retail diagnostic ${category} ${code} is sanitized rather than a receipt`,()=>{
  const {job,item}=retailFailure(category,code)
  assert.throws(()=>discoveryToolReceipt(item,job),error=>{assert.equal(error.code,code);assert.equal(error.message,code);return true})
 })
 for(const protocol of ['exec','app-server'])test(`${protocol} retail ${category} ${code} settles failure without receipts or fallback`,async()=>{
  const {job,item}=retailFailure(category,code,protocol==='app-server')
  const failure=await invokeFailure(protocol,job,[item])
  assert.equal(failure.code,code);assert.deepEqual(failedToolEvidence(failure),[])
  if(protocol==='exec'){
   assert.equal(failure.modelExecutionEvidence.outcome,'failed');assert.equal(failure.modelExecutionEvidence.attempts.length,1);assert.equal(failure.modelExecutionEvidence.attempts[0].errorCode,code);assert.equal(failure.modelExecutionEvidence.fallbackUsed,false)
  }else{
   assert.equal(failure.modelBindingEvidence.outcome,'failed');assert.deepEqual(failure.modelBindingEvidence.observedErrors,[code]);assert.ok(Object.isFrozen(failure.modelBindingEvidence.observedErrors));assert.equal(failure.modelAttemptEvidence.errorCode,code)
  }
  let saved,calls=0
  const entry={version:3,job:{id:job.id,lease_token:'generated-lease'},phase:'finished',reply:'',error:failure.code,evidence:failedToolEvidence(failure),modelExecutionEvidence:failure.modelExecutionEvidence,modelBindingEvidence:failure.modelBindingEvidence}
  await deliverWorkerEntry({workerId:'generated-worker',retryWait:async()=>{},rpc:async(name,input)=>{
   calls++;assert.equal(name,'hq_worker_finish_v4');assert.equal(input.p_error,code);assert.equal(input.p_reply,'');assert.deepEqual(input.p_evidence,[]);assert.equal((input.p_model_evidence??input.p_trial_evidence).outcome,'failed')
   return {accepted:true,trialReceiptAccepted:true}
  },write:async value=>{saved=value}},entry)
  assert.equal(calls,1);assert.equal(saved.phase,'delivered');assert.equal(saved.error,null);assert.deepEqual(saved.evidence,[])
 })
}
const forgedDiagnostics=[
 ['unknown diagnostic',({item})=>{item.result.content[0].text='discovery-private-provider-error'}],
 ['narrative prefix',({item})=>{item.result.content[0].text='Provider says discovery-access-denied'}],
 ['trailing text',({item})=>{item.result.content[0].text+='\nprivate provider response'}],
 ['missing error marker',({item})=>{delete item.result.isError}],
 ['false error marker',({item})=>{item.result.isError=false}],
 ['structured metadata',({item})=>{item.result.structured_content={policyId:retailPolicy}}],
 ['camel structured metadata',({item})=>{item.result.structuredContent={private:'provider text'}}],
 ['extra result field',({item})=>{item.result.private='provider text'}],
 ['extra text field',({item})=>{item.result.content[0].private='provider text'}],
 ['multiple text blocks',({item})=>{item.result.content.push({...item.result.content[0]})}],
 ['nontext block',({item})=>{item.result.content[0].type='image'}],
 ['wrong server',({item})=>{item.server='untrusted_server'}],
 ['wrong tool',({item})=>{item.tool='untrusted_tool'}],
 ['nonempty arguments',({item})=>{item.arguments={query:'private task text'}}],
 ['wrong status',({item})=>{item.status='failed'}],
 ['provider error field',({item})=>{item.error={message:'private provider response'}}],
 ['unknown category',({job})=>{job.context.publicDiscoveryPermit.category='pharmacy'}],
 ['permit job mismatch',({job})=>{job.context.publicDiscoveryPermit.jobId='other-job'}],
 ['permit agent mismatch',({job})=>{job.context.publicDiscoveryPermit.agentId='AG-HR-002'}],
 ['identity mismatch',({job})=>{job.context.agent.id='AG-HR-002'}],
 ['binding digest mismatch',({job})=>{job.context.publicDiscoveryPermit.bindingDigest='c'.repeat(64)}],
 ['extra permit field',({job})=>{job.context.publicDiscoveryPermit.query='private task text'}],
 ['repair attempt',({job})=>{job.context.task.attempt=1}],
 ['trial category mismatch',({job})=>{job.context.supervisedTrial.category='footwear'}],
]
for(const [name,mutate] of forgedDiagnostics)test(`retail diagnostic rejects ${name} without accepting provider text`,()=>{
 const value=retailFailure('clothing',discoveryFailures[0],true);mutate(value)
 assert.throws(()=>discoveryToolReceipt(value.item,value.job),error=>{assert.equal(error.code,'provider-mcp-evidence-invalid');assert.equal(error.message,'provider-mcp-evidence-invalid');return true})
})
for(const protocol of ['exec','app-server']){
 test(`${protocol} forged diagnostic text never escapes the fixed sanitizer`,async()=>{
  const {job,item}=retailFailure('clothing','discovery-access-denied private provider response',protocol==='app-server')
  const failure=await invokeFailure(protocol,job,[item]);assert.equal(failure.code,'provider-mcp-evidence-invalid');assert.deepEqual(failedToolEvidence(failure),[])
  assert.doesNotMatch(JSON.stringify(failure.modelExecutionEvidence??failure.modelBindingEvidence),/private provider response/)
 })
 test(`${protocol} duplicate failed MCP items remain a single failed attempt with zero receipts`,async()=>{
  const {job,item}=retailFailure('clothing',discoveryFailures[0],protocol==='app-server')
  const failure=await invokeFailure(protocol,job,[item,structuredClone(item)])
  assert.equal(failure.code,discoveryFailures[0]);assert.deepEqual(failedToolEvidence(failure),[]);if(protocol==='exec'){assert.equal(failure.modelExecutionEvidence.attempts.length,1);assert.equal(failure.modelExecutionEvidence.fallbackUsed,false)}else{assert.deepEqual(failure.modelBindingEvidence.observedErrors,[discoveryFailures[0]]);assert.equal(failure.modelAttemptEvidence.outcome,'failed')}
 })
}

for(const protocol of ['exec','app-server'])for(const metadata of ['structured_content','structuredContent','both'])test(`${protocol} rejects diagnostic carrying ${metadata} metadata`,async()=>{
 const {job,item}=retailFailure('clothing',discoveryFailures[0],protocol==='app-server')
 if(metadata!=='structuredContent')item.result.structured_content={private:'provider response'}
 if(metadata!=='structured_content')item.result.structuredContent={private:'provider response'}
 const failure=await invokeFailure(protocol,job,[item]);assert.equal(failure.code,'provider-mcp-evidence-invalid');assert.deepEqual(failedToolEvidence(failure),[])
})
