/** Generated founder state; actual composable, no hosted requests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope } from 'vue'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@building-suit/ui/utils/hqTaskBrowserSource') return { url:'data:text/javascript,export const provideHqTaskBrowserSource=()=>{}', shortCircuit:true }
  if (specifier.startsWith('#shared/')) return next(new URL(`../../shared/${specifier.slice(8)}.ts`,import.meta.url).href,context)
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return next(`${specifier}.ts`,context)
  return next(specifier,context)
} })
const { useHqAgents } = await import('../../app/composables/useHqAgents.ts')
const flush=async()=>{for(let n=0;n<40;n++)await Promise.resolve()}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const skillFileId='synthetic_skill_001',trialId='11111111-1111-4111-8111-111111111111'
const state=overrides=>({skillFileId,eligible:true,qualified:false,trialId:null,taskId:null,status:null,receiptIssued:false,reviewComplete:false,bindingCurrent:true,...overrides})
const row=publicResearch=>({agentId:'AG-RES-002',eligible:false,qualified:true,receiptIssued:true,reviewComplete:true,skillFileId,trialId:null,status:null,publicResearch})
const snapshot=()=>({version:2,conversationId:null,agents:[],messages:[],jobs:[],tasks:[],lessons:[],runtime:{connected:false,lastSeenAt:null}})
async function fixture(t,initial=state()) {
  const access=ref({status:'founder',user:{displayName:'Generated founder',detailLabel:'Test'}}),mounts=[],disposers=[],posts=[]
  let current=initial, heldRead=null
  const scope=effectScope(),descriptors=new Map()
  const globals={ref,shallowRef,computed,watch,navigator:{onLine:true},onMounted:fn=>mounts.push(fn),onScopeDispose:fn=>disposers.push(fn),
    useHqLiveEvents:()=>({subscribe(){},subscribePresence(){},invalidate(){}}),
    $fetch:(url,options={})=>{
      if(options.method==='POST'){const request={...deferred(),url,options};posts.push(request);return request.promise}
      if(url==='/api/hq/trials')return Promise.resolve([row(current)])
      assert.equal(url,'/api/hq/agents');return heldRead ? heldRead.promise : Promise.resolve(snapshot())
    }}
  for(const [key,value]of Object.entries(globals)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
  const result=scope.run(()=>useHqAgents(()=>access.value))
  let disposed=false
  const dispose=()=>{if(disposed)return;disposed=true;disposers.forEach(fn=>fn());scope.stop()}
  t.after(async()=>{dispose();await flush();for(const[key,d]of descriptors){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key]}})
  mounts.forEach(fn=>fn());await flush()
  return {access,posts,result,dispose,holdRead:()=>{heldRead=deferred();return heldRead},set:value=>{current=value}}
}
const start={action:'start-public-research',skillFileId}
test('start uses guarded dedicated endpoint, suppresses duplicate clicks and records no qualification',async t=>{
 const f=await fixture(t),pending=f.result.trialCommand(start);await flush();await f.result.trialCommand(start)
 assert.equal(f.posts.length,1);assert.equal(f.posts[0].url,'/api/hq/research-trials')
 assert.deepEqual(Object.keys(f.posts[0].options.body).sort(),['requestKey','skillFileId'])
 assert.match(f.posts[0].options.body.requestKey,/^[0-9a-f-]{36}$/)
 assert.equal(f.posts[0].options.headers['X-HQ-Access'],'1');assert.equal(f.posts[0].options.credentials,'same-origin');assert.equal(f.posts[0].options.retry,0)
 f.set(state({status:'active',trialId}));f.posts[0].resolve({accepted:true,trialId,status:'active'});await pending
 assert.match(f.result.agents.value.trialMessage,/does not grant qualification/)
 assert.equal(f.result.agents.value.trials[0].publicResearch.qualified,false)
})
test('uncertain start retains exact request identity and does not automatically retry',async t=>{
 const f=await fixture(t);let call=f.result.trialCommand(start);await flush();const key=f.posts[0].options.body.requestKey
 f.posts[0].reject(Error('synthetic transport'));await call;assert.equal(f.posts.length,1)
 assert.match(f.result.agents.value.trialMessage,/unconfirmed/)
 call=f.result.trialCommand(start);await flush();assert.equal(f.posts[1].options.body.requestKey,key)
 f.posts[1].resolve({accepted:true,trialId});await call
})
for(const [name,change]of Object.entries({ineligible:{eligible:false},qualified:{qualified:true},active:{status:'active'},reviewReady:{reviewComplete:true},missingSkill:{skillFileId:null}}))test(`${name} cannot start`,async t=>{
 const f=await fixture(t,state(change));await f.result.trialCommand(start);assert.equal(f.posts.length,0)
})
test('qualification requires matching current independently reviewed trial, separate from ordinary endpoint',async t=>{
 const f=await fixture(t,state({trialId,status:'passed',reviewComplete:true}))
 await f.result.trialCommand({action:'qualify-public-research',trialId:'22222222-2222-4222-8222-222222222222'});assert.equal(f.posts.length,0)
 const call=f.result.trialCommand({action:'qualify-public-research',trialId});await flush()
 assert.equal(f.posts[0].url,'/api/hq/research-trials/qualification');assert.deepEqual(f.posts[0].options.body,{trialId})
 f.posts[0].resolve({accepted:true});await call
 const ordinary=f.result.trialCommand({action:'qualify',trialId});await flush();assert.equal(f.posts[1].url,'/api/hq/trials');f.posts[1].resolve({accepted:true});await ordinary
})
for(const change of [{bindingCurrent:false},{reviewComplete:false},{receiptIssued:true}])test(`qualification gate ${JSON.stringify(change)}`,async t=>{
 const f=await fixture(t,state({trialId,status:'passed',reviewComplete:true,...change}));await f.result.trialCommand({action:'qualify-public-research',trialId});assert.equal(f.posts.length,0)
})
for(const end of ['logout','dispose'])test(`${end} suppresses late action feedback and further dispatch`,async t=>{
 const f=await fixture(t),call=f.result.trialCommand(start);await flush()
 if(end==='logout')f.access.value={status:'anonymous'};else f.dispose()
 f.posts[0].resolve({accepted:true,trialId});await call
 assert.equal(f.result.agents.value.trialMessage,'');await f.result.trialCommand(start);assert.equal(f.posts.length,1)
})
test('malformed capability projection cannot expose a new command',async t=>{
 const f=await fixture(t,state({extraAuthority:true}));assert.equal(f.result.agents.value.trials[0].publicResearch,undefined)
 await f.result.trialCommand(start);assert.equal(f.posts.length,0)
})

test('CEO send superseding a background read cannot leave trial controls permanently pending',async t=>{
 const f=await fixture(t),read=f.holdRead(),refresh=f.result.refresh();await flush()
 const trial=f.result.trialCommand(start);await flush();assert.equal(f.result.agents.value.trialPending,true)
 const send=f.result.send('Generated internal draft request');await flush()
 assert.equal(f.posts[1].url,'/api/hq/ceo/messages')
 f.posts[0].reject(Error('synthetic timeout'));await trial
 assert.equal(f.result.agents.value.trialPending,false)
 // The superseded command cannot display feedback in a newer snapshot epoch.
 assert.equal(f.result.agents.value.trialMessage,'')
 read.resolve(snapshot());f.posts[1].resolve(snapshot());await Promise.all([refresh,send])
})
