import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorEntitlement,doctorEntitlementKey } from '../../app/utils/entitlement.ts'
import { doctorLocationContext } from '../../app/utils/locationContext.ts'
import { doctorScopeKey } from '../../app/utils/contextScope.ts'
import { createDoctorContextController,doctorContextState } from '../../app/utils/contextController.ts'
const id=n=>`ae120000-0000-0000-0000-${String(n).padStart(12,'0')}`
const actor={userId:id(1),sessionId:id(11),practiceId:id(21)}
const epoch=Date.parse('2026-10-17T00:00:00Z')
const entitlement=(change={})=>({state:'trial',revision:1,writes_allowed:true,can_add_staff:true,can_add_clinic:false,over_limit:false,valid_until:new Date(epoch+10000).toISOString(),observed_at:new Date(epoch).toISOString(),...change})
const row=(change={})=>({practice_id:id(21),location_id:id(31),practice_name:'Synthetic practice',doctor_name:'Synthetic owner',location_name:'Synthetic clinic',timezone:'Etc/UTC',portal:'doctor',grants_version:1,location_version:1,capabilities:['patients.read','patients.write','appointments.read'],edition:'administrative_candidate',edition_revision:2,entitlement:entitlement(),...change})
const expired=(change={})=>entitlement({state:'expired',writes_allowed:false,can_add_staff:false,observed_at:new Date(epoch+10000).toISOString(),...change})
const flush=async()=>{for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve))}
function clock() {
  let now=0;let next=0;const jobs=new Map()
  return {now:()=>now,set(callback,delay){const id=++next;jobs.set(id,{callback,due:now+delay});return id},clear(id){jobs.delete(id)},
    count:()=>jobs.size,next:()=>Math.min(...[...jobs.values()].map(job=>job.due)),
    advance(ms){now+=ms;for(const[id,job]of[...jobs])if(job.due<=now){jobs.delete(id);job.callback()}}}
}
function controller(data,timers,repository={}) {
  let preference=null;const state=doctorContextState()
  const api={load:async()=>[data.value],resolve:async()=>data.value,...repository}
  const value=createDoctorContextController(api,state,()=>actor,'local',{read:()=>preference,write:value=>{preference=value}},timers)
  return {value,state,api}
}
test('candidate entitlement metadata is mandatory and invalid state/authority couplings fail closed',()=>{
  assert.equal(doctorEntitlement(undefined,undefined),undefined)
  assert.throws(()=>doctorEntitlement(undefined,'administrative_candidate'),/RESPONSE_INVALID/)
  for(const change of [{state:'paid'},{revision:0},{revision:1.5},{writes_allowed:'true'},{can_add_staff:'true'},{valid_until:null},{observed_at:'invalid'},
    {state:'expired'},{state:'suspended'},{state:'unconfigured'},{over_limit:true},{writes_allowed:false}])assert.throws(()=>doctorEntitlement(entitlement(change),'administrative_candidate'),/RESPONSE_INVALID/)
  const unconfigured={state:'unconfigured',revision:0,writes_allowed:false,can_add_staff:false,can_add_clinic:false,over_limit:false,valid_until:null,observed_at:new Date(epoch).toISOString()}
  assert.equal(doctorEntitlement(unconfigured,'administrative_candidate').writesAllowed,false)
  assert.throws(()=>doctorEntitlement({...unconfigured,writes_allowed:true},'administrative_candidate'),/RESPONSE_INVALID/)
  assert.throws(()=>doctorEntitlement(entitlement(),'synthetic_preview'),/RESPONSE_INVALID/)
  assert.throws(()=>doctorLocationContext(row({entitlement:undefined}),actor,'local'),/CONTEXT_RESPONSE_INVALID/)
})
test('trial and retained historical states expose only bounded entitlement flags',()=>{
  const parsed=doctorEntitlement({...entitlement(),subscriber_user_id:id(2),monthly_minor:999,commercial_approval_ref:'SYNTHETIC_PRIVATE'},'administrative_candidate')
  assert.equal(parsed.writesAllowed,true);assert.equal(Object.hasOwn(parsed,'monthly_minor'),false);assert.equal(Object.hasOwn(parsed,'subscriber_user_id'),false)
  assert.equal(doctorEntitlement(expired(),'administrative_candidate').state,'expired')
  assert.equal(doctorEntitlement(entitlement({over_limit:true,writes_allowed:true,can_add_staff:false}),'administrative_candidate').writesAllowed,true)
  assert.equal(doctorEntitlement(entitlement({over_limit:true,writes_allowed:false,can_add_staff:false}),'administrative_candidate').writesAllowed,false)
  assert.throws(()=>doctorEntitlement(expired({observed_at:new Date(epoch).toISOString()}),'administrative_candidate'),/RESPONSE_INVALID/)
})
test('cache identity includes computed state and allowance changes while ignoring observation timestamps',()=>{
  const first=doctorLocationContext(row(),actor,'local');const observed=doctorLocationContext(row({entitlement:entitlement({observed_at:new Date(epoch+1000).toISOString()})}),actor,'local')
  assert.equal(doctorScopeKey(first,'patients'),doctorScopeKey(observed,'patients'))
  assert.deepEqual(doctorEntitlementKey(first.entitlement),doctorEntitlementKey(observed.entitlement))
  for(const value of [expired(),entitlement({revision:2}),entitlement({can_add_staff:false}),entitlement({over_limit:true,can_add_staff:false})]){
    const next=doctorLocationContext(row({entitlement:value}),actor,'local');assert.notEqual(doctorScopeKey(first,'patients'),doctorScopeKey(next,'patients'))
  }
})
test('same-revision expiry invalidates captured work and drafts while retaining role/history scope',async()=>{
  const data={value:row()};const {value,state}=controller(data);await value.refresh()
  let draft='Synthetic private draft';value.registerClear(()=>{draft=''})
  const capture=value.capture('patients');data.value=row({entitlement:expired()});await value.refresh()
  assert.equal(capture.accepts(),false);assert.equal(capture.signal.aborted,true);assert.equal(draft,'')
  assert.equal(state.current.entitlement.revision,1);assert.equal(state.current.entitlement.writesAllowed,false)
  assert.deepEqual(state.current.capabilities,['patients.read','patients.write','appointments.read'])
})
test('server observations refresh the deadline without discarding a draft on ordinary reload',async()=>{
  const timers=clock();const data={value:row()};const {value,state}=controller(data,timers);await value.refresh()
  let draft='Synthetic pending draft';value.registerClear(()=>{draft=''})
  const capture=value.capture('patients');timers.advance(5000)
  data.value=row({entitlement:entitlement({observed_at:new Date(epoch+5000).toISOString()})});await value.refresh()
  assert.equal(draft,'Synthetic pending draft');assert.equal(capture.accepts(),true);assert.equal(timers.next(),10000)
  data.value=row({entitlement:expired()});timers.advance(5000)
  assert.equal(state.current,null);assert.equal(capture.signal.aborted,true)
  await flush();assert.equal(state.current.entitlement.state,'expired');assert.equal(draft,'');assert.equal(timers.count(),0)
})
test('expiry removes local authority before a failed refresh and never regrants from the clock',async()=>{
  const timers=clock();const data={value:row()};const {value,state,api}=controller(data,timers);await value.refresh()
  const capture=value.capture('patients');api.load=async()=>{throw Error('Synthetic offline')}
  timers.advance(10000);await flush();assert.equal(state.current,null);assert.equal(state.phase,'error');assert.equal(state.error,'network');assert.equal(capture.accepts(),false);assert.equal(timers.count(),0)
})
test('request latency consumes the server allowance and large timers chunk without overflow',async()=>{
  const timers=clock();const data={value:row()};const first=controller(data,timers,{resolve:async()=>{timers.advance(3000);return data.value}})
  await first.value.refresh();assert.equal(timers.next(),10000);await first.value.clear();assert.equal(timers.count(),0)
  const long=clock();const end=2147483647+10000;data.value=row({entitlement:entitlement({valid_until:new Date(epoch+end).toISOString()})})
  const second=controller(data,long);await second.value.refresh();assert.equal(long.next(),2147483647)
  long.advance(2147483647);assert.equal(second.state.phase,'ready');assert.equal(long.next(),end)
  await second.value.clear();assert.equal(long.count(),0)
})
