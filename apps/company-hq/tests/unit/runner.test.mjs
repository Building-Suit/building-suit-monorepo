import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from '../../scripts/load-test-module.mjs'
const D = await load('../server/utils/hqDomain.ts')
const { HqStore } = await load('../server/utils/hqStore.ts')
const W = await load('../server/utils/hqWorkflow.ts')
const { HqRunner } = await load('../server/utils/hqRunner.ts')
const founder = { id: 'founder', role: 'founder' }
const readiness = { enabled: true, backendScopeVerified: true, modelScopeVerified: true, persistentHostVerified: true, zeroCostHostVerified: true }
const brainFiles = { 'AG-CEO-001':'ceo-profile', 'AG-HR-001':'maya-profile', 'AG-HR-002':'noah-profile', 'AG-HR-003':'iris-profile', playbook:'playbook', ...Object.fromEntries(['bootstrap', 'charter', 'workingAgreement', 'registry', 'organization', 'hrCharter', 'workforceSkill', 'home', 'soul', 'milestones', 'mode'].map(k=>[k,'source-'+k])) }
let seq=0
const action=(s, input)=>s.execute(founder,D.parseFounderAction({idempotencyKey:'r'+ ++seq,...input},founder))
function setup(s=new HqStore(':memory:'), daily=false) {
 const {id}=action(s,{action:'create_task',title:'Synthetic workflow',brief:'Evaluate supplied evidence',acceptance:'Independent accepted report',allowedActions:'Read approved profiles and public research only'})
 action(s,{action:'approve_task',id})
 action(s,{action:'authorize_workflow',id,allowedTools:['public.search'],publicInputs:['Synthetic query'],brainFiles,daily,timezoneConfirmed:daily})
 return {s,id}
}
function adapters(overrides={}) {
 const calls=[],reads=[];let allowance=4,reservations=0
 const brain={async read(id,{cache}){assert.equal(cache,'no-store');reads.push(id);return {id,revision:'v1',text:'Synthetic current profile '+id,accessedAt:new Date().toISOString()}}}
 const executor={
  async verify(){return {authenticated:true,zeroIncrementalCost:true,remainingCalls:allowance}},
  async reserve(){assert.ok(allowance>0);allowance--;return {id:'reservation-'+ ++reservations,zeroIncrementalCost:true}},
  async invoke(input){
   calls.push(input)
   if(input.stage==='evaluate') assert.deepEqual(input.artifacts.map(a=>a.stage),['research'])
   return {identity:{agentId:input.agentId,contextId:input.contextId,principalId:'synthetic-host',isolated:true},output:'Synthetic '+input.stage,sources:['playbook'],...(input.stage==='evaluate'?{review:{accepted:true,artifactDigest:W.digest(input.artifacts[0].output),evidence:'Synthetic independent assessment'}}:{})}
  },...overrides,
 }
 return {brain,executor,calls,reads,refill:()=>{allowance=4}}
}
const runner=(s,a,ready=readiness,tools)=>new HqRunner(s,ready,a.executor,a.brain,tools)
const mutate=(s,f)=>s.transaction(document=>({document,result:f(document)}))

test('four workers supplement legacy identities without changing completed historical task references',()=>{
 const s=new HqStore(':memory:');const state=D.projectState(s.read(),founder,'sqlite')
 assert.deepEqual(state.agents.map(a=>[a.id,a.name]),[['ceo','Steve'],['hr','Maya']])
 assert.deepEqual(state.workforce.map(a=>a.agentId),['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003'])
 assert.equal(state.tasks[0].id,'HR-001');assert.equal(state.tasks[0].owner,'hr');assert.equal(state.tasks[0].status,'completed');s.close()
})
test('explicit founder approval, bounded tools and distinct Brain files are required',()=>{
 const s=new HqStore(':memory:');const {id}=action(s,{action:'create_task',title:'T',brief:'B',acceptance:'A',allowedActions:'R'})
 const approve={action:'authorize_workflow',id,allowedTools:[],publicInputs:[],brainFiles,daily:false,timezoneConfirmed:false}
 assert.throws(()=>action(s,approve),/approved queued/)
 action(s,{action:'approve_task',id})
 for(const patch of [{allowedTools:['send.email']},{brainFiles:{...brainFiles,'AG-HR-003':'noah-profile'}},{daily:true,timezoneConfirmed:false}]) assert.throws(()=>action(s,{...approve,...patch}))
 const key='ordered-scope-'+ ++seq
 const receipt=action(s,{...approve,idempotencyKey:key})
 assert.deepEqual(action(s,{...approve,idempotencyKey:key,brainFiles:Object.fromEntries(Object.entries(brainFiles).reverse())}),receipt)
 assert.throws(()=>action(s,approve),/once/)
 const ceo={id:'ceo',role:'ceo'}
 assert.throws(()=>s.execute(ceo,D.parseAgentAction('hq_update_task',{requestKey:'spoof',id,status:'running',detail:'Bypass runner'},ceo)),/bounded runner/)
 s.close()
})
test('default scheduler and each missing runtime verification fail closed before claiming or calling',async()=>{
 const {s,id}=setup();const a=adapters()
 await assert.rejects(()=>new HqRunner(s).run(id),/RUNNER_NOT_VERIFIED/)
 for(const key of Object.keys(readiness))await assert.rejects(()=>runner(s,a,{...readiness,[key]:false}).run(id),/RUNNER_NOT_VERIFIED/)
 assert.equal(s.read().workflowRuns,undefined);assert.equal(a.calls.length,0);s.close()
})
test('actual SQLite orchestration checkpoints Noah → isolated Iris → Maya → Steve and atomically delivers once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-run-')),path=join(dir,'db.sqlite');let {s,id}=setup(new HqStore(path));const a=adapters()
 const result=await runner(s,a).run(id);assert.equal(result.status,'completed')
 assert.deepEqual(a.calls.map(c=>c.agentId),['AG-HR-002','AG-HR-003','AG-HR-001','AG-CEO-001'])
 assert.equal(new Set(a.calls.map(c=>c.contextId)).size,4);assert.equal(a.reads.length,80)
 const run=Object.values(s.read().workflowRuns)[0];assert.equal(Object.keys(run.checkpoints).length,4)
 assert.ok(run.checkpoints.research.brain.every(f=>f.revision==='v1'));assert.equal(run.outbox.status,'delivered')
 s.close();s=new HqStore(path);assert.equal((await runner(s,a).run(id)).status,'already_claimed_or_finished')
 assert.equal(s.read().messages.filter(m=>m.id===result.receipt).length,1);assert.equal(s.read().tasks[0].status,'completed')
 assert.equal(D.projectState(s.read(),{id:'hr',role:'hr'},'sqlite').messages.length,0)
 s.close();rmSync(dir,{recursive:true,force:true})
})
test('model authentication, cost and exhausted allowance block with durable failure evidence',async()=>{
 for(const patch of [{authenticated:false},{zeroIncrementalCost:false},{remainingCalls:0}]) {
  const {s,id}=setup();const a=adapters({async verify(){return {authenticated:true,zeroIncrementalCost:true,remainingCalls:4,...patch}}})
  assert.equal((await runner(s,a).run(id)).code,'AUTH_OR_QUOTA_UNAVAILABLE');assert.equal(a.calls.length,0);assert.equal(s.read().tasks[0].status,'blocked');assert.equal(D.projectState(s.read(),founder,'sqlite').agents[0].status,'idle')
  assert.equal(Object.values(s.read().workflowRuns)[0].failures[0].code,'AUTH_OR_QUOTA_UNAVAILABLE');s.close()
 }
})
test('missing, stale or unauthorized Brain content never reaches the model',async()=>{
 for(const mode of ['denied','stale','wrong-file']) {
  const {s,id}=setup();const a=adapters();a.brain.read=async(id)=>{if(mode==='denied')throw Error('secret provider detail');return {id:mode==='wrong-file'?'unapproved':id,revision:'v1',text:'fixture',accessedAt:mode==='stale'?'2020-01-01':new Date().toISOString()}}
  assert.equal((await runner(s,a).run(id)).status,'blocked');assert.equal(a.calls.length,0)
  assert.ok(!JSON.stringify(s.read().workflowRuns).includes('secret provider detail'));s.close()
 }
})
test('rejected review or forged executor identity prevents Maya and report delivery',async()=>{
 for(const mode of ['rejected','self','context','stale']) {
  const {s,id}=setup();const a=adapters(),invoke=a.executor.invoke
  a.executor.invoke=async input=>{const out=await invoke(input);if(input.stage==='evaluate') {if(mode==='rejected')out.review.accepted=false;if(mode==='self')out.identity.agentId='AG-HR-002';if(mode==='context')out.identity.contextId=a.calls[0].contextId;if(mode==='stale')out.review.artifactDigest='bad'}return out}
  assert.equal((await runner(s,a).run(id)).status,'blocked');assert.equal(a.calls.length,2);assert.equal(s.read().messages.length,0);if(mode==='rejected'||mode==='stale')assert.equal(Object.values(s.read().workflowRuns)[0].rejectedReviews.length,1);s.close()
 }
})
test('revoked approval during an in-flight model aborts and fences its eventual result',async()=>{
 const {s,id}=setup();const a=adapters();let observedAbort=false
 a.executor.invoke=async input=>{action(s,{action:'cancel_task',id});return new Promise((_,reject)=>input.signal.addEventListener('abort',()=>{observedAbort=true;reject(input.signal.reason)},{once:true}))}
 const result=await runner(s,a).run(id);assert.equal(result.status,'blocked');assert.equal(observedAbort,true)
 const run=Object.values(s.read().workflowRuns)[0];assert.equal(run.status,'cancelled');assert.deepEqual(run.checkpoints,{});assert.equal(s.read().messages.length,0);s.close()
})
test('caller cancellation aborts even a noncooperative model and cannot save a late result',async()=>{
 const {s,id}=setup();const a=adapters();const c=new AbortController()
 a.executor.invoke=async()=>{c.abort();return new Promise(()=>{})}
 assert.equal((await runner(s,a).run(id,{signal:c.signal})).status,'blocked');assert.equal(s.read().messages.length,0);s.close()
})
test('scoped tool broker records actual reads, rejects unauthorized calls and unobserved citations',async()=>{
 for(const mode of ['allowed','denied','invented','private-query']) {
  const {s,id}=setup();const a=adapters(),invoke=a.executor.invoke;let toolCalls=0
  const tools={async read(){toolCalls++;return {text:'Synthetic public source',references:['https://example.com/source']}}}
  a.executor.invoke=async input=>{if(input.stage==='research')await input.tool(mode==='denied'?'send.email':'public.search',mode==='private-query'?'Private content must not leave':'Synthetic query');const result=await invoke(input);if(mode==='invented')result.sources=['https://invented.example/'];return result}
  const result=await runner(s,a,readiness,tools).run(id)
  assert.equal(result.status,mode==='allowed'?'completed':'blocked');assert.equal(toolCalls,['denied','private-query'].includes(mode)?0:1)
  if(mode==='allowed') assert.equal(Object.values(s.read().workflowRuns)[0].checkpoints.research.toolCalls.length,1)
  s.close()
 }
})
test('restart reuses committed stages and rejects changed Brain policy before further execution',async()=>{
 for(const changed of [false,true]) {
  const {s,id}=setup();const a=adapters(),invoke=a.executor.invoke
  a.executor.invoke=async input=>{if(input.stage==='evaluate')throw Error('fixture outage');return invoke(input)}
  assert.equal((await runner(s,a).run(id)).status,'blocked');a.executor.invoke=invoke;a.refill()
  if(changed){const read=a.brain.read;a.brain.read=async(...args)=>({...await read(...args),revision:'v2'})}
  const result=await runner(s,a).run(id)
  assert.equal(result.status,changed?'blocked':'completed');assert.equal(a.calls.filter(c=>c.stage==='research').length,1)
  if(changed)assert.equal(result.code,'BRAIN_CHANGED_REAPPROVAL_REQUIRED');s.close()
 }
})
test('separate SQLite connections compete for one claim; expired generation fences old checkpoint',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-claim-')),path=join(dir,'db.sqlite');const {s,id}=setup(new HqStore(path),true);const b=new HqStore(path),now=Date.parse('2026-11-03T06:00:00Z')
 const first=mutate(s,doc=>W.claim(doc,id,'a',now,true));assert.ok(first)
 assert.equal(mutate(b,doc=>W.claim(doc,id,'b',now+1,true)),null)
 const second=mutate(b,doc=>W.claim(doc,id,'b',now+60001,true));assert.equal(second.generation,2)
 assert.throws(()=>mutate(s,doc=>W.leasedRun(doc,first,now+60002)),/STALE/)
 action(s,{action:'cancel_task',id});assert.throws(()=>mutate(b,doc=>W.leasedRun(doc,second,now+60003)),/STALE/)
 s.close();b.close();rmSync(dir,{recursive:true,force:true})
})
test('Cairo uses DST, current local date and the documented 08:00 start time',()=>{
 assert.equal(W.dailySlot(Date.parse('2026-11-03T05:59:59Z')).due,false)
 assert.equal(W.dailySlot(Date.parse('2026-11-03T06:00:00Z')).due,true)
 assert.equal(W.dailySlot(Date.parse('2026-07-03T04:59:59Z')).due,false)
 assert.equal(W.dailySlot(Date.parse('2026-07-03T05:00:00Z')).due,true)
 assert.equal(W.dailySlot(Date.parse('2026-11-03T22:00:00Z')).localDate,'2026-11-04')
})
test('daily scheduler runs at most once per local date and rejects multiple standing schedules',async()=>{
 const {s,id}=setup(undefined,true);const a=adapters();let now=Date.parse('2026-11-03T06:00:00Z')
 a.brain.read=async id=>({id,revision:'v1',text:'Synthetic Brain',accessedAt:new Date(now).toISOString()})
 const r=new HqRunner(s,readiness,a.executor,a.brain,undefined,()=>now)
 assert.equal((await r.tick()).status,'completed');assert.equal((await r.tick()).status,'already_claimed_or_finished');assert.equal(s.read().messages.length,1)
 now+=86400000;a.refill();assert.equal((await r.tick()).status,'completed');assert.equal(s.read().messages.length,2);assert.equal(Object.keys(s.read().brainSnapshots).length,16)
 setup(s,true);await assert.rejects(()=>r.tick(),/MULTIPLE_DAILY_APPROVALS/)
 action(s,{action:'cancel_task',id});s.close()
})
test('delivery is rolled back with inbox and replay uses the pending outbox, not another model call',async()=>{
 const {s,id}=setup();const a=adapters(),transaction=s.transaction.bind(s);let fail=true
 s.transaction=reduce=>transaction(doc=>{const result=reduce(doc);if(fail&&doc.messages.some(m=>m.id.startsWith('workflow_'))){fail=false;throw Error('Synthetic commit failure')}return result})
 assert.equal((await runner(s,a).run(id)).status,'blocked');assert.equal(s.read().messages.length,0)
 assert.equal(Object.values(s.read().workflowRuns)[0].outbox.status,'pending')
 assert.equal((await runner(s,a).run(id)).status,'completed');assert.equal(a.calls.length,4);assert.equal(s.read().messages.length,1);s.close()
})

test('two independent processes atomically compete for the same daily SQLite claim',async()=>{
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util')
 const dir=mkdtempSync(join(tmpdir(),'hq-process-')),path=join(dir,'db.sqlite');const {s,id}=setup(new HqStore(path),true);s.close()
 const loader=new URL('../../scripts/load-test-module.mjs',import.meta.url).href
 const code=`const {load}=await import(${JSON.stringify(loader)}); const {HqStore}=await load('../server/utils/hqStore.ts'); const W=await load('../server/utils/hqWorkflow.ts'); const s=new HqStore(process.argv[1]); const result=s.transaction(document=>({document,result:W.claim(document,process.argv[2],process.argv[3],Date.parse('2026-11-03T06:00:00Z'),true)}));console.log(JSON.stringify(result));s.close()`
 const results=await Promise.all(['process-a','process-b'].map(owner=>promisify(execFile)(process.execPath,['--input-type=module','-e',code,path,id,owner])))
 assert.equal(results.map(r=>JSON.parse(r.stdout)).filter(Boolean).length,1);rmSync(dir,{recursive:true,force:true})
})
test('ignored tool denials cannot be converted into a successful checkpoint',async()=>{
 const {s,id}=setup();const a=adapters(),invoke=a.executor.invoke
 a.executor.invoke=async input=>{try{await input.tool('send.email','No')}catch { /* Model ignores the denied tool deliberately. */ }return invoke(input)}
 assert.equal((await runner(s,a).run(id)).code,'TOOL_DENIED_OR_UNFINISHED');assert.deepEqual(Object.values(s.read().workflowRuns)[0].checkpoints,{});s.close()
})
test('uncertain inference retries are bounded and reservations remain in durable evidence',async()=>{
 const {s,id}=setup();const a=adapters({async invoke(){throw Error('Synthetic lost reply')}})
 const r=runner(s,a)
 assert.equal((await r.run(id)).status,'blocked');assert.equal((await r.run(id)).status,'blocked')
 assert.equal((await r.run(id)).code,'RETRY_LIMIT')
 const attempts=Object.values(s.read().workflowRuns)[0].attempts;assert.equal(attempts.length,2);assert.equal(new Set(attempts.map(a=>a.reservationId)).size,2);s.close()
})
test('company storage boundaries do not share claims, approval or reports',async()=>{
 const left=setup(),right=setup();const a=adapters()
 await assert.rejects(()=>runner(right.s,a).run(left.id),/APPROVAL/)
 assert.equal(a.calls.length,0);assert.equal((await runner(left.s,a).run(left.id)).status,'completed')
 assert.equal(right.s.read().messages.length,0);assert.equal(right.s.read().workflowRuns,undefined)
 left.s.close();right.s.close()
})
test('revoked model access before delivery blocks outbox creation despite four saved outputs',async()=>{
 const {s,id}=setup();const a=adapters(),verify=a.executor.verify
 a.executor.verify=async signal=>({...await verify(signal),authenticated:a.calls.length<4})
 assert.equal((await runner(s,a).run(id)).code,'AUTH_OR_QUOTA_UNAVAILABLE')
 assert.equal(Object.keys(Object.values(s.read().workflowRuns)[0].checkpoints).length,4);assert.equal(s.read().messages.length,0);s.close()
})

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const configured = (s,a,limits,now=Date.now) => new HqRunner(s,readiness,a.executor,a.brain,undefined,now,limits)
test('real adapter latency beyond 30 seconds completes while renewable leases exclude contenders', {timeout:65_000}, async()=>{
 const {s,id}=setup();const a=adapters(),read=a.brain.read,invoke=a.executor.invoke;let reads=0,contenders=0
 a.brain.read=async(...args)=>{if(++reads<=16)await delay(1500);return read(...args)}
 a.executor.invoke=async input=>{if(input.stage==='research')await delay(11_000);return invoke(input)}
 const start=Date.now()
 const contender=setInterval(()=>{assert.equal(mutate(s,doc=>W.claim(doc,id,'contender',Date.now(),false,1000)),null);contenders++},1300)
 try {
  assert.equal((await configured(s,a,{stageMs:60_000,leaseMs:1000}).run(id)).status,'completed')
  assert.ok(Date.now()-start>30_000);assert.ok(contenders>20);assert.equal(a.reads.length,80)
  assert.equal(Object.values(s.read().workflowRuns)[0].generation,1)
 } finally {clearInterval(contender);s.close()}
})
test('limits reject unbounded values and timeout noncooperative reads, auth, reservation and inference',async()=>{
 const {s}=setup();const a=adapters()
 for(const limits of [{stageMs:Infinity},{adapterMs:0},{inferenceMs:300001},{leaseMs:999},{stageMs:NaN}])assert.throws(()=>configured(s,a,limits),/INVALID_RUNNER_LIMITS/)
 s.close()
 for(const mode of ['read','verify','reserve','invoke','stage']) {
  const fixture=setup(),b=adapters();let signal
  const hang=async (...args)=>{signal=mode==='read'?args[1].signal:mode==='invoke'||mode==='stage'?args[0].signal:args[0];return new Promise(()=>{})}
  if(mode==='read')b.brain.read=hang;else b.executor[mode==='stage'?'invoke':mode]=hang
  const limits=mode==='stage'?{stageMs:100}:{adapterMs:100,inferenceMs:100}
  const result=await configured(fixture.s,b,limits).run(fixture.id)
  assert.equal(result.code,{read:'BRAIN_READ_TIMEOUT',verify:'ADAPTER_TIMEOUT',reserve:'RESERVATION_TIMEOUT',invoke:'INFERENCE_TIMEOUT',stage:'STAGE_TIMEOUT'}[mode])
  assert.equal(signal.aborted,true);assert.equal(fixture.s.read().messages.length,0);fixture.s.close()
 }
})
test('persistent cancellation during slow reads and inference prevents late continuation',async()=>{
 for(const mode of ['read','invoke']) {
  const {s,id}=setup(),a=adapters();const original=mode==='read'?a.brain.read:a.executor.invoke;let signal,lateFinished=false
  const slow=async(...args)=>{signal=mode==='read'?args[1].signal:args[0].signal;setTimeout(()=>action(s,{action:'cancel_task',id}),120);await delay(400);lateFinished=true;return original(...args)}
  if(mode==='read')a.brain.read=slow;else a.executor.invoke=slow
  const result=await runner(s,a).run(id);assert.equal(result.status,'blocked');assert.equal(signal.aborted,true)
  await delay(450);assert.equal(lateFinished,true)
  const run=Object.values(s.read().workflowRuns)[0];assert.equal(run.status,'cancelled');assert.equal(run.evidenceBudget,0);assert.deepEqual(run.checkpoints,{});assert.equal(s.read().messages.length,0)
  if(mode==='read')assert.equal(a.calls.length,0);s.close()
 }
})
test('expired owner cannot renew or mutate a replacement run after a delayed adapter result',async()=>{
 const {s,id}=setup(),a=adapters();let now=Date.now(),oldLease,newLease,resolveRead
 a.brain.read=async source=>{
  const run=Object.values(s.read().workflowRuns)[0];oldLease={key:run.key,owner:run.owner,generation:run.generation}
  now+=1001
  assert.throws(()=>mutate(s,doc=>W.renewLease(doc,oldLease,now,1000)),/STALE/)
  newLease=mutate(s,doc=>W.claim(doc,id,'replacement',now,false,1000))
  return new Promise(resolve=>{resolveRead=()=>resolve({id:source,revision:'v1',text:'Late',accessedAt:new Date(now).toISOString()})})
 }
 const result=await configured(s,a,{leaseMs:1000},()=>now).run(id)
 assert.equal(result.code,'STALE_OR_CANCELLED_LEASE');assert.equal(newLease.generation,2)
 const before=s.read();resolveRead();await delay(30)
 assert.deepEqual(s.read(),before);assert.equal(a.calls.length,0)
 assert.throws(()=>mutate(s,doc=>W.renewLease(doc,oldLease,now,1000)),/STALE/);s.close()
})
test('snapshot deduplication survives restart/replay and reconstructs every original access losslessly',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-evidence-')),path=join(dir,'db.sqlite');let {s,id}=setup(new HqStore(path));const a=adapters(),read=a.brain.read,invoke=a.executor.invoke,observed=[]
 a.brain.read=async(...args)=>{const file={...await read(...args),text:'Synthetic long Brain '+ 'x'.repeat(39_900)};observed.push(file);return file}
 a.executor.invoke=async input=>{if(input.stage==='evaluate')throw Error('Synthetic restart');return invoke(input)}
 assert.equal((await runner(s,a).run(id)).status,'blocked')
 const before=s.read(),research=Object.values(before.workflowRuns)[0].checkpoints.research
 assert.equal(Object.keys(before.brainSnapshots).length,16)
 assert.ok(research.brain.every(f=>f.blob&&!('text' in f)))
 assert.deepEqual(W.reconstructBrain(before,research),observed.slice(0,16))
 s.close();s=new HqStore(path);a.executor.invoke=invoke;a.refill()
 assert.equal((await runner(s,a).run(id)).status,'completed');assert.equal(a.calls.filter(c=>c.stage==='research').length,1)
 const after=s.read(),run=Object.values(after.workflowRuns)[0]
 assert.equal(Object.keys(after.brainSnapshots).length,16);assert.deepEqual(run.checkpoints.research,research)
 for(const evidence of Object.values(run.checkpoints)){
  const rebuilt=W.reconstructBrain(after,evidence);assert.equal(rebuilt.length,16)
  for(const file of rebuilt)assert.ok(observed.some(o=>JSON.stringify(o)===JSON.stringify(file)))
 }
 assert.ok(Buffer.byteLength(JSON.stringify(after))<800_000)
 assert.equal((await runner(s,a).run(id)).status,'already_claimed_or_finished');s.close();rmSync(dir,{recursive:true,force:true})
})
test('inline historical evidence remains readable and snapshot corruption or same-revision changes fail closed',async()=>{
 const {s,id}=setup(),a=adapters(),invoke=a.executor.invoke
 a.executor.invoke=async input=>{if(input.stage==='evaluate')throw Error('Synthetic pause');return invoke(input)}
 assert.equal((await runner(s,a).run(id)).status,'blocked')
 mutate(s,doc=>{const evidence=Object.values(doc.workflowRuns)[0].checkpoints.research;evidence.brain=W.reconstructBrain(doc,evidence)})
 const original=s.read();const evidence=Object.values(original.workflowRuns)[0].checkpoints.research
 assert.deepEqual(W.reconstructBrain(original,evidence),evidence.brain)
 const read=a.brain.read;a.brain.read=async(...args)=>({...await read(...args),text:'Changed content with the same revision'})
 a.executor.invoke=invoke;a.refill();assert.equal((await runner(s,a).run(id)).code,'BRAIN_CHANGED_REAPPROVAL_REQUIRED')
 assert.deepEqual(Object.values(s.read().workflowRuns)[0].checkpoints.research,evidence)
 const reference={brain:W.retainBrain(original,evidence.brain)};const key=reference.brain[0].blob
 original.brainSnapshots[key].text='Tampered';assert.throws(()=>W.reconstructBrain(original,reference),/BRAIN_SNAPSHOT_CORRUPT/)
 delete original.brainSnapshots[key];assert.throws(()=>W.reconstructBrain(original,reference),/BRAIN_SNAPSHOT_CORRUPT/);s.close()
})
test('capacity preflight prevents allowance reservation/inference without deleting historical evidence',async()=>{
 const {s,id}=setup(),a=adapters();let reservations=0
 a.executor.reserve=async()=>{reservations++;throw Error('Must not reserve')}
 mutate(s,doc=>{doc.events.push({id:'history',agent:'ceo',type:'audit',title:'Historical evidence',detail:'x'.repeat(5_700_000),createdAt:'2026-11-03'})})
 const history=s.read().events
 assert.equal((await runner(s,a).run(id)).code,'HQ_CAPACITY');assert.equal(reservations,0);assert.equal(a.calls.length,0)
 assert.deepEqual(s.read().events,history);assert.equal(s.read().brainSnapshots,undefined)
 assert.equal(Object.values(s.read().workflowRuns)[0].evidenceBudget,0);s.close()
})
test('reserved result headroom excludes competing writes and persists across reopen until fenced reclaim',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-budget-')),path=join(dir,'db.sqlite');let {s,id}=setup(new HqStore(path));const now=Date.now()
 const lease=mutate(s,doc=>W.claim(doc,id,'old',now,false))
 const files=[{id:'synthetic',revision:'1',text:'Retained evidence',accessedAt:new Date(now).toISOString()}]
 mutate(s,doc=>W.reserveEvidence(doc,lease,files,'Assignment',now))
 s.close();s=new HqStore(path);assert.ok(Object.values(s.read().workflowRuns)[0].evidenceBudget>2_400_000)
 const before=s.read()
 assert.throws(()=>mutate(s,doc=>{doc.events.push({id:'fill',detail:'x'.repeat(5_700_000)})}),/storage is full/)
 assert.deepEqual(s.read(),before)
 const next=mutate(s,doc=>W.claim(doc,id,'new',now+60_001,false))
 assert.equal(next.generation,2);assert.equal(Object.values(s.read().workflowRuns)[0].evidenceBudget,0)
 assert.deepEqual(s.read().brainSnapshots,before.brainSnapshots)
 assert.throws(()=>mutate(s,doc=>W.reserveEvidence(doc,lease,files,'Old writer',now+60_001)),/STALE/)
 s.close();rmSync(dir,{recursive:true,force:true})
})
test('capacity reservation covers maximum JSON escaping, tools, sources and review without relaxing 8 MB',()=>{
 const {s,id}=setup(),now=Date.now(),lease=mutate(s,doc=>W.claim(doc,id,'boundary',now,false))
 const files=Object.values(brainFiles).map(id=>({id,revision:'\u0000'.repeat(1000),text:'\u0000'.repeat(40_000),accessedAt:new Date(now).toISOString()}))
 const input='\u0000'.repeat(50_000),brain=mutate(s,doc=>W.reserveEvidence(doc,lease,files,input,now))
 mutate(s,doc=>{
  doc.events.push({id:'preserve',agent:'ceo',type:'audit',title:'Capacity boundary',detail:'',createdAt:'2026-11-03'})
  const room=8_000_000-Buffer.byteLength(JSON.stringify(doc))-doc.workflowRuns[lease.key].evidenceBudget-1000
  assert.ok(room>0);doc.events.at(-1).detail='x'.repeat(room)
 })
 const history=s.read().events
 const evidence={stage:'research',agentId:'AG-HR-002',contextId:'context',principalId:'\u0000'.repeat(200),input,inputDigest:W.digest(input),brain,allowedTools:['public.read','public.search'],toolCalls:Array.from({length:6},()=>({name:'public.search',input:'\u0000'.repeat(4000),output:'\u0000'.repeat(20_000)})),output:'\u0000'.repeat(12_000),sources:Array.from({length:100},()=> 'https://'+ '\u0000'.repeat(1991)),review:{accepted:true,artifactDigest:'x'.repeat(64),evidence:'\u0000'.repeat(12_000)},startedAt:new Date(now).toISOString(),completedAt:new Date(now).toISOString()}
 mutate(s,doc=>W.checkpoint(doc,lease,evidence,now))
 const saved=s.read();assert.deepEqual(saved.events,history);assert.deepEqual(W.reconstructBrain(saved,saved.workflowRuns[lease.key].checkpoints.research),files)
 assert.ok(Buffer.byteLength(JSON.stringify(saved))<8_000_000);assert.equal(saved.workflowRuns[lease.key].evidenceBudget,0);s.close()
})
test('elapsed deadlines are checked after a blocked writer lock before model dispatch',async()=>{
 const {s,id}=setup(),a=adapters(),transaction=s.transaction.bind(s);let delayed=false
 s.transaction=reduce=>transaction(doc=>{
  const run=Object.values(doc.workflowRuns||{})[0]
  if(run?.evidenceBudget&&!run.attempts.length&&!delayed){delayed=true;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200)}
  return reduce(doc)
 })
 assert.equal((await configured(s,a,{stageMs:150}).run(id)).code,'STAGE_TIMEOUT')
 assert.equal(delayed,true);assert.equal(a.calls.length,0);assert.equal(Object.values(s.read().workflowRuns)[0].attempts.length,0);s.close()
})
