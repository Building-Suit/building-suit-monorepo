import test from 'node:test'
import assert from 'node:assert/strict'
import {createNativeContext,nativeContextId} from '../../mobile/doctor/app/utils/nativeContext.ts'
const id=n=>'d4040000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor={userId:id(1),sessionId:id(2),environment:'local'}
const choice=n=>({context:{contractVersion:1,product:'doctor-suit',dataMode:'synthetic',...actor,doctorId:id(n),practiceId:id(n+1),locationId:id(n+2),portal:'secretary',grantsVersion:1,locationVersion:1,capabilities:['patients.read']},practiceName:'Synthetic practice '+n,doctorName:'Synthetic doctor '+n,locationName:'Synthetic location '+n})
const a=choice(10),b=choice(20)
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise}}
function fixture(){let current=actor,options=[a,b],dirty=false,clears=0;const port={list:async()=>options,resolve:async x=>x};const context=createNativeContext(port,()=>current,undefined,()=>{clears++},()=>dirty);return{context,port,set actor(v){current=v},set options(v){options=v},set dirty(v){dirty=v},get clears(){return clears}}}
test('server choices require explicit selection and retain independent secretary capabilities',async()=>{
 const f=fixture();await f.context.refresh();assert.equal(f.context.state.phase,'choosing');assert.equal(f.context.selection(),null)
 assert.equal(await f.context.choose(nativeContextId(a.context)),true);assert.deepEqual(f.context.state.current.context.capabilities,['patients.read']);assert.equal(f.context.state.current.context.portal,'secretary')
})
test('switch clears protected state, aborts prior read and discards delayed Doctor A response',async()=>{
 const f=fixture();await f.context.refresh();const d=deferred();let firstSignal
 f.port.resolve=async(x,_actor,signal)=>{if(x.context.doctorId===a.context.doctorId){firstSignal=signal;return d.promise}return x}
 const first=f.context.choose(nativeContextId(a.context));await new Promise(r=>setImmediate(r));assert.equal(await f.context.choose(nativeContextId(b.context)),true)
 d.resolve(a);assert.equal(await first,false);assert.equal(firstSignal.aborted,true);assert.equal(f.context.state.current.context.doctorId,b.context.doctorId);assert.equal(f.clears,2)
})
test('unsaved edits need explicit discard confirmation and cancellation preserves current scope',async()=>{
 const f=fixture();await f.context.refresh();await f.context.choose(nativeContextId(a.context));f.dirty=true
 assert.equal(await f.context.choose(nativeContextId(b.context)),false);assert.equal(f.context.state.current.context.doctorId,a.context.doctorId);f.context.cancel();assert.equal(f.context.state.pending,null)
 await f.context.choose(nativeContextId(b.context));assert.equal(await f.context.confirm(),true);assert.equal(f.context.state.current.context.doctorId,b.context.doctorId)
})
test('revocation removes only affected scope without silently adopting another doctor',async()=>{
 const f=fixture();await f.context.refresh();await f.context.choose(nativeContextId(a.context));f.options=[b];assert.equal(await f.context.refresh(),false)
 assert.equal(f.context.selection(),null);assert.deepEqual(f.context.state.options,[b]);assert.equal(f.context.state.phase,'choosing');assert.equal(await f.context.choose(nativeContextId(b.context)),true)
})
test('session replacement and clear prevent delayed lists restoring old choices',async()=>{
 const f=fixture(),d=deferred();f.port.list=async()=>d.promise;const load=f.context.refresh();f.actor={...actor,sessionId:id(3)};await f.context.clear();d.resolve([a]);assert.equal(await load,false);assert.deepEqual(f.context.state.options,[])
})
test('unchanged polls preserve drafts; changed grants and offline errors clear authority',async()=>{
 const f=fixture();await f.context.refresh();await f.context.choose(nativeContextId(a.context));const before=f.clears;await f.context.refresh();assert.equal(f.clears,before)
 f.options=[{...a,context:{...a.context,grantsVersion:2,capabilities:[]}},b];assert.equal(await f.context.refresh(),false);assert.equal(f.context.selection(),null)
 f.port.list=async()=>{throw new Error('Offline')};await f.context.refresh();assert.equal(f.context.state.phase,'error');assert.deepEqual(f.context.state.options,[])
})
