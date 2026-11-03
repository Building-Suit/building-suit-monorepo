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
 now+=86400000;a.refill();assert.equal((await r.tick()).status,'completed');assert.equal(s.read().messages.length,2)
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
