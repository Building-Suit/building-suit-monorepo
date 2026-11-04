import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { load } from '../../scripts/load-test-module.mjs'
const D=await load('../server/utils/hqDomain.ts')
const {HqStore}=await load('../server/utils/hqStore.ts'),{HqRunner}=await load('../server/utils/hqRunner.ts')
const {ResponsesProtocol,DisabledResponsesExecutor}=await load('../server/utils/hqResponsesProtocol.ts')
const {DriveBrainAdapter}=await load('../server/utils/hqDriveBrain.ts'),{openDisabledHqHost}=await load('../server/utils/hqHostBootstrap.ts')
const {protocolDeadline,protocolText}=await load('../server/utils/hqProtocolHttp.ts')
const founder={id:'founder',role:'founder'},ready={enabled:true,backendScopeVerified:true,modelScopeVerified:true,persistentHostVerified:true,zeroCostHostVerified:true}
const keys=['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','playbook','bootstrap','charter','workingAgreement','registry','organization','hrCharter','workforceSkill','home','soul','milestones','mode']
const files=Object.fromEntries(keys.map(k=>[k,'file-'+k]))
let sequence=0
const action=(s,body)=>s.execute(founder,D.parseFounderAction({idempotencyKey:'adapter-'+ ++sequence,...body},founder))
const mutate=(s,fn)=>s.transaction(document=>({document,result:fn(document)}))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function fixture(path=':memory:') {
 const s=new HqStore(path),{id}=action(s,{action:'create_task',title:'Synthetic transport',brief:'Analyze synthetic Brain',acceptance:'Independent review',allowedActions:'Approved read-only scope'})
 action(s,{action:'approve_task',id});action(s,{action:'authorize_workflow',id,allowedTools:[],publicInputs:[],brainFiles:files,daily:false,timezoneConfirmed:false})
 const brain={async read(id){return {id,revision:'1',text:'Synthetic PROFILE '+id,accessedAt:new Date().toISOString()}}}
 return {s,id,brain}
}
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
function envelope(input,patch={}) {
 const payload={output:'Synthetic '+input.stage,sources:['file-playbook'],review:input.stage==='evaluate'?{accepted:true,artifactDigest:input.artifacts[0].digest,evidence:'Synthetic independent review'}:null}
 return {id:'resp_synthetic_'+input.stage,model:'synthetic-pinned',status:'completed',error:null,incomplete_details:null,usage:{input_tokens:50,output_tokens:20,total_tokens:70},output:[{type:'reasoning'},{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(payload)}]}],...patch}
}
function harness(f,handler=(url,init,input)=>json(envelope(input)),timeout=1000) {
 const requests=[],inputs=[];let current,reservations=0
 const transport=async(url,init)=>{requests.push({url,init});return handler(url,init,current)}
 const protocol=new ResponsesProtocol(f.s,transport,'synthetic-pinned','synthetic-host',timeout)
 const executor={async verify(){return {authenticated:true,zeroIncrementalCost:true,remainingCalls:4}},async reserve(){return {id:'synthetic-reservation-'+ ++reservations,zeroIncrementalCost:true}},async invoke(input,id){current=input;inputs.push(input);return protocol.invoke(input,id)}}
 return {protocol,requests,inputs,executor,runner:new HqRunner(f.s,ready,executor,f.brain)}
}
test('production Responses boundary is closed without credentials or a user-asserted budget flag',async()=>{
 const f=fixture(),executor=new DisabledResponsesExecutor()
 assert.deepEqual(await executor.verify(new AbortController().signal),{authenticated:false,zeroIncrementalCost:false,remainingCalls:0})
 await assert.rejects(()=>executor.reserve(new AbortController().signal),/No verified atomic/)
 await assert.rejects(()=>executor.invoke({signal:new AbortController().signal},'fake'),/No verified atomic/)
 assert.equal((await new HqRunner(f.s,ready,executor,f.brain).run(f.id)).code,'AUTH_OR_QUOTA_UNAVAILABLE')
 assert.equal(f.s.read().providerOperations,undefined);f.s.close()
})
test('synthetic Responses transport routes four isolated stages with exact approved context and usage evidence',async()=>{
 const f=fixture(),h=harness(f);assert.equal((await h.runner.run(f.id)).status,'completed')
 assert.equal(h.requests.length,4);assert.equal(new Set(h.inputs.map(i=>i.contextId)).size,4)
 for(const [index,{url,init}] of h.requests.entries()) {
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store')
  const body=JSON.parse(init.body)
  assert.equal(body.store,false);assert.equal(body.background,false);assert.equal(body.stream,false);assert.deepEqual(body.tools,[])
  assert.equal(body.previous_response_id,undefined);assert.equal(body.conversation,undefined);assert.equal(body.text.format.strict,true)
  assert.equal(body.input.length,2);assert.equal(init.headers.Authorization,undefined)
  assert.equal(JSON.parse(body.input[0].content).profile,'Synthetic PROFILE '+files[h.inputs[index].agentId])
 }
 const iris=JSON.parse(h.requests[1].init.body)
 assert.ok(!iris.input[0].content.includes('PROFILE file-AG-HR-002'))
 assert.deepEqual(JSON.parse(iris.input[1].content).artifacts.map(a=>a.stage),['research'])
 const operations=Object.values(f.s.read().providerOperations);assert.equal(operations.length,4)
 for(const op of operations){assert.equal(op.state,'completed');assert.equal(op.accounting,'unreconciled');assert.equal(op.usage.totalTokens,70);assert.ok(op.resultDigest)}
 const evidence=Object.values(f.s.read().workflowRuns)[0].checkpoints
 assert.equal(evidence.evaluate.principalId,'synthetic-host');assert.notEqual(evidence.evaluate.contextId,evidence.research.contextId);f.s.close()
})
test('no transport before a durable approved attempt; profile substitution and stale generation fail closed',async()=>{
 for(const mode of ['missing','profile','stale']) {
  const f=fixture(),h=harness(f),invoke=h.executor.invoke
  if(mode==='missing')await assert.rejects(()=>h.protocol.invoke({signal:new AbortController().signal,contextId:'missing',assignment:'{}'},'none'),/RESPONSES_ATTEMPT_REQUIRED/)
  else {
   h.executor.invoke=async(input,id)=>{
    if(mode==='profile')return invoke({...input,profile:'Unapproved replacement'},id)
    mutate(f.s,doc=>{Object.values(doc.workflowRuns)[0].generation++});return invoke(input,id)
   }
   assert.equal((await h.runner.run(f.id)).status,'blocked')
  }
  assert.equal(h.requests.length,0);f.s.close()
 }
})
test('unknown Responses outcomes survive restart and quarantine further dispatch without refund or automatic retry',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-protocol-')),path=join(dir,'hq.sqlite');const f=fixture(path)
 const h=harness(f,async()=>{throw Error('Synthetic lost response; private transport details')})
 assert.equal((await h.runner.run(f.id)).status,'blocked');assert.equal(h.requests.length,1)
 const saved=f.s.read();assert.equal(Object.values(saved.providerOperations)[0].state,'ambiguous')
 assert.ok(!JSON.stringify(saved).includes('private transport details'));f.s.close();f.s=new HqStore(path)
 const restarted=harness(f);let reservations=0;restarted.executor.reserve=async()=>{reservations++;return {id:'synthetic-reservation-after-restart',zeroIncrementalCost:true}}
 await assert.rejects(()=>restarted.runner.run(f.id),/RESPONSES_UNCERTAIN_OUTCOME/);assert.equal(restarted.requests.length,0);assert.equal(reservations,0)
 assert.deepEqual(f.s.read().providerOperations,saved.providerOperations);assert.equal(Object.values(f.s.read().providerOperations)[0].accounting,'unreconciled')
 f.s.close();rmSync(dir,{recursive:true,force:true})
})
test('synthetic HTTP refusal is never retried and observed usage is never treated as a free allowance',async()=>{
 for(const status of [401,403,429,500]) {
  const f=fixture(),h=harness(f,()=>new Response('private error body',{status}))
  assert.equal((await h.runner.run(f.id)).code,'PROTOCOL_HTTP_'+status);assert.equal(h.requests.length,1)
  const op=Object.values(f.s.read().providerOperations)[0];assert.equal(op.state,status===500?'ambiguous':'rejected');assert.equal(op.accounting,'unreconciled')
  assert.ok(!JSON.stringify(f.s.read()).includes('private error body'));f.s.close()
 }
})
test('Responses rejects malformed output, refusal, tools, identity injection, missing usage and unobserved citations',async()=>{
 for(const mode of ['json','refusal','tool','identity','usage','citation','other-profile','incomplete','oversized']) {
  const f=fixture(),h=harness(f,(url,init,input)=>{
   if(mode==='json')return new Response('{broken')
   if(mode==='oversized')return new Response('x'.repeat(256001))
   const data=envelope(input)
   if(mode==='refusal')data.output[1].content=[{type:'refusal',refusal:'No'}]
   if(mode==='tool')data.output=[{type:'function_call',name:'send_email',arguments:'{}'}]
   if(mode==='usage')delete data.usage
   if(mode==='incomplete')data.status='incomplete'
   if(mode==='identity'||mode==='citation'||mode==='other-profile'){
    const payload=JSON.parse(data.output[1].content[0].text)
    if(mode==='identity')payload.identity={agentId:'AG-CEO-001',isolated:true};else payload.sources=[mode==='other-profile'?'file-AG-CEO-001':'https://unobserved.example/']
    data.output[1].content[0].text=JSON.stringify(payload)
   }
   return json(data)
  })
  assert.equal((await h.runner.run(f.id)).status,'blocked');assert.equal(h.requests.length,1)
  assert.equal(f.s.read().messages.length,0);assert.deepEqual(Object.values(f.s.read().workflowRuns)[0].checkpoints,{})
  assert.equal(Object.values(f.s.read().providerOperations)[0].accounting,'unreconciled');f.s.close()
 }
})
test('Responses deadline and founder cancellation fence noncooperative transport and late output',async()=>{
 for(const mode of ['timeout','cancel']) {
  const f=fixture();let settled=false,signal
  const h=harness(f,async(url,init,input)=>{
   signal=init.signal
   if(mode==='cancel')setTimeout(()=>action(f.s,{action:'cancel_task',id:f.id}),20)
   await pause(240);settled=true;return json(envelope(input))
  },mode==='timeout'?50:1000)
  assert.equal((await h.runner.run(f.id)).status,'blocked');assert.equal(signal.aborted,true)
  const before=f.s.read();await pause(280);assert.equal(settled,true);assert.deepEqual(f.s.read(),before)
  assert.equal(Object.values(before.providerOperations)[0].state,'ambiguous');assert.equal(before.messages.length,0);f.s.close()
 }
})
test('provider journal capacity is required before any synthetic HTTP dispatch',async()=>{
 const f=fixture(),h=harness(f),invoke=h.executor.invoke
 h.executor.invoke=async(input,id)=>{
  mutate(f.s,doc=>{
   doc.events.push({id:'fill',agent:'ceo',type:'audit',title:'Retained',detail:'',createdAt:new Date().toISOString()})
   const budget=Object.values(doc.workflowRuns).reduce((n,r)=>n+(r.evidenceBudget||0),0)
   doc.events.at(-1).detail='x'.repeat(8_000_000-Buffer.byteLength(JSON.stringify(doc))-budget-10)
  })
  return invoke(input,id)
 }
 assert.equal((await h.runner.run(f.id)).code,'HQ_CAPACITY');assert.equal(h.requests.length,0);assert.equal(f.s.read().providerOperations,undefined);f.s.close()
})
const metadata=(id,mimeType='text/plain',version='1')=>({id,mimeType,version,trashed:false,capabilities:{canDownload:true}})
test('Drive synthetic transport reads exact IDs afresh with before/after metadata and lossless plain text',async()=>{
 const requests=[];const transport=async(url,init)=>{requests.push({url,init});return url.includes('alt=media')?new Response('Synthetic Brain العربية'):json(metadata('approved'))}
 const adapter=new DriveBrainAdapter(['approved'],transport),signal=new AbortController().signal
 const first=await adapter.read('approved',{cache:'no-store',signal}),second=await adapter.read('approved',{cache:'no-store',signal})
 assert.equal(requests.length,6);assert.equal(first.text,'Synthetic Brain العربية');assert.equal(first.revision,second.revision)
 for(const {url,init} of requests){assert.equal(new URL(url).origin,'https://www.googleapis.com');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.headers['Cache-Control'],'no-cache, no-store')}
 await assert.rejects(()=>adapter.read('other',{cache:'no-store',signal}),/DRIVE_SCOPE_DENIED/)
 await assert.rejects(()=>adapter.read('approved',{cache:'force-cache',signal}),/DRIVE_SCOPE_DENIED/);assert.equal(requests.length,6)
})
test('Drive exports native Docs to text; rejects shortcuts, revision races, revocation and oversized bodies',async()=>{
 for(const mode of ['docs','shortcut','changed','revoked','download-denied','oversized','bad-utf8','redirect']) {
  let calls=0
  const adapter=new DriveBrainAdapter(['approved'],async(url)=>{
   calls++
   if(calls===1||calls===3){
    if(mode==='revoked'&&calls===3)return new Response('denied',{status:403})
    const data=metadata('approved',mode==='docs'?'application/vnd.google-apps.document':mode==='shortcut'?'application/vnd.google-apps.shortcut':'text/plain',mode==='changed'&&calls===3?'2':'1')
    if(mode==='download-denied')data.capabilities.canDownload=false
    return json(data)
   }
   if(mode==='docs')assert.ok(url.endsWith('/export?mimeType=text%2Fplain'))
   if(mode==='oversized')return new Response('x'.repeat(160001))
   if(mode==='bad-utf8')return new Response(new Uint8Array([0xff]))
   if(mode==='redirect'){const response=new Response('text');Object.defineProperty(response,'redirected',{value:true});return response}
   return new Response('Synthetic content')
  })
  const read=()=>adapter.read('approved',{cache:'no-store',signal:new AbortController().signal})
  if(mode==='docs')assert.equal((await read()).text,'Synthetic content');else await assert.rejects(read)
 }
})
test('Drive bounds stalled transports/streams and cancellation prevents further reads',async()=>{
 for(const mode of ['transport','stream','cancel']) {
  let calls=0,cancelled=false;const controller=new AbortController()
  const adapter=new DriveBrainAdapter(['approved'],async(url,init)=>{
   calls++
   if(mode==='transport'){init.signal.addEventListener('abort',()=>{cancelled=true},{once:true});return new Promise(()=>{})}
   if(calls===1)return json(metadata('approved'))
   if(mode==='cancel')setTimeout(()=>controller.abort(),10)
   return new Response(new ReadableStream({cancel(){cancelled=true}}))
  },50)
  await assert.rejects(()=>adapter.read('approved',{cache:'no-store',signal:controller.signal}))
  assert.equal(cancelled,true);assert.equal(calls,mode==='transport'?1:2)
 }
})
test('manual host bootstrap requires existing dedicated SQLite and stays disabled across reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-host-')),path=join(dir,'hq.sqlite');const f=fixture(path),before=f.s.read();f.s.close()
 for(const bad of [':memory:','relative.sqlite',join(dir,'missing.sqlite')])assert.throws(()=>openDisabledHqHost(bad))
 assert.equal(existsSync(join(dir,'missing.sqlite')),false)
 const link=join(dir,'link.sqlite');symlinkSync(path,link);assert.throws(()=>openDisabledHqHost(link),/PERSISTENT_HQ_FILE_REQUIRED/)
 const foreign=join(dir,'foreign.sqlite'),db=new DatabaseSync(foreign);db.exec('create table other(id); pragma user_version=1');db.close()
 assert.throws(()=>openDisabledHqHost(foreign),/HQ_DATABASE_IDENTITY/)
 const host=openDisabledHqHost(path);assert.equal(host.status.enabled,false)
 await assert.rejects(()=>host.tick(),/RUNNER_NOT_VERIFIED/);host.close();host.close()
 await assert.rejects(()=>host.tick(),/HOST_CLOSED/)
 const reopened=new HqStore(path);assert.deepEqual(reopened.read(),before);reopened.close();rmSync(dir,{recursive:true,force:true})
})
test('completed response cannot be dispatched twice, including after an uncertain checkpoint boundary',async()=>{
 const f=fixture(),h=harness(f),invoke=h.executor.invoke;let savedInput,savedReservation
 h.executor.invoke=async(input,id)=>{savedInput=input;savedReservation=id;await invoke(input,id);throw Error('Synthetic crash before checkpoint')}
 assert.equal((await h.runner.run(f.id)).status,'blocked');assert.equal(h.requests.length,1)
 const run=Object.values(f.s.read().workflowRuns)[0]
 // Restore only the original synthetic lease to exercise the protocol replay guard directly.
 mutate(f.s,doc=>{const r=doc.workflowRuns[run.key];r.status='running';r.leaseUntil=Date.now()+60000;doc.tasks.find(t=>t.id===f.id).status='running'})
 const liveInput={...savedInput,signal:new AbortController().signal}
 await assert.rejects(()=>h.protocol.invoke(liveInput,savedReservation),/RESPONSES_REPLAY_REQUIRES_RECONCILIATION/)
 assert.equal(h.requests.length,1);assert.equal(Object.values(f.s.read().providerOperations)[0].state,'completed');f.s.close()
})
test('crashed dispatch journal survives without treating an unknown request as an unused reservation',async()=>{
 const f=fixture(),h=harness(f,async()=>{throw Error('Synthetic disconnect')})
 assert.equal((await h.runner.run(f.id)).status,'blocked')
 mutate(f.s,doc=>{Object.values(doc.providerOperations)[0].state='dispatched'})
 await assert.rejects(()=>h.runner.run(f.id),/RESPONSES_UNCERTAIN_OUTCOME/)
 assert.equal(h.requests.length,1);assert.equal(Object.values(f.s.read().providerOperations)[0].accounting,'unreconciled');f.s.close()
})
function controlledBody() {
 let pulls=0,cancels=0,notify
 const cancelled=new Promise(resolve=>{notify=resolve})
 const body=new ReadableStream({
  pull(){pulls++},
  cancel(){cancels++;notify();return new Promise(()=>{})},
 },{highWaterMark:0})
 return {response:new Response(body),cancelled,counts:()=>({pulls,cancels})}
}
async function promptly(promise) {
 let timer
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Synthetic cleanup did not settle promptly')),1000)})])}
 finally{clearTimeout(timer)}
}
test('late transport bodies are cancelled without reads after deadline or parent cancellation, even if cleanup stalls',async()=>{
 for(const mode of ['deadline','parent']) {
  const body=controlledBody(),parent=new AbortController();let release,calls=0,transportSignal
  const pending=new Promise(resolve=>{release=resolve})
  const result=protocolDeadline(parent.signal,mode==='deadline'?50:500,async(signal,check)=>protocolText(async(url,init)=>{
   calls++;transportSignal=init.signal;return pending
  },'https://synthetic.example/body',{signal},1024,check))
  // Let transport start; then cancel while its noncooperative promise is unresolved.
  await Promise.resolve()
  if(mode==='parent')parent.abort()
  await promptly(assert.rejects(result,error=>error.code===(mode==='deadline'?'PROTOCOL_TIMEOUT':'PROTOCOL_CANCELLED')))
  assert.equal(transportSignal.aborted,true);assert.deepEqual(body.counts(),{pulls:0,cancels:0})
  release(body.response)
  await promptly(body.cancelled)
  await Promise.resolve()
  assert.deepEqual(body.counts(),{pulls:0,cancels:1});assert.equal(calls,1)
 }
})
test('redirect and URL-rejected bodies are cancelled without reads or follow-up requests when cleanup stalls',async()=>{
 for(const mode of ['redirect','url']) {
  const body=controlledBody();let calls=0
  if(mode==='redirect')Object.defineProperty(body.response,'redirected',{value:true})
  else Object.defineProperty(body.response,'url',{value:'https://unapproved.example/body'})
  const result=protocolDeadline(new AbortController().signal,500,async(signal,check)=>protocolText(async()=>{
   calls++;return body.response
  },'https://synthetic.example/body',{signal},1024,check))
  await promptly(assert.rejects(result,error=>error.code==='PROTOCOL_REDIRECT'))
  await promptly(body.cancelled)
  assert.deepEqual(body.counts(),{pulls:0,cancels:1});assert.equal(calls,1)
 }
})
