import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyClinicalSnapshot} from '@building-suit/contracts'
import {createNativeEncounter} from '../../mobile/doctor/app/utils/nativeEncounter.ts'
const id=n=>'d4060000-0000-4000-8000-'+String(n).padStart(12,'0')
const context={contractVersion:1,product:'doctor-suit',dataMode:'synthetic',environment:'local',portal:'doctor',userId:id(1),sessionId:id(2),doctorId:id(1),practiceId:id(4),locationId:id(5),grantsVersion:1,locationVersion:1,capabilities:['patients.read']}
const record=()=>({encounter:{id:id(10),practice_id:context.practiceId,location_id:context.locationId,responsible_doctor:context.doctorId,status:'draft',version:1},versions:[{id:id(11),snapshot:emptyClinicalSnapshot()}],data_mode:'synthetic',clinical_approval:false,live_prescribing:false})
const receipt=()=>({encounter_id:id(10),version:2,version_id:id(12),status:'draft',release_id:null,data_mode:'synthetic',clinical_approval:false,live_prescribing:false})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}}
function fixture(){let selected=context,current=record(),calls=0;const port={detail:async()=>structuredClone(current),save:async()=>{calls++;return receipt()}};const controller=createNativeEncounter(port,()=>selected,undefined,()=>id(90));return{controller,port,set context(v){selected=v},set record(v){current=v},get calls(){return calls}}}
test('native notes require current owner and an editable fresh synthetic revision',async()=>{
 const f=fixture();assert.equal(f.controller.edit(),false);assert.equal(await f.controller.load(id(10)),true);assert.equal(f.controller.edit(),true);f.controller.state.draft.note.sections[0].text='Synthetic entered note';assert.equal(await f.controller.save(),true);assert.equal(f.controller.state.outcome,'acknowledged');assert.equal(f.controller.state.detail,null);assert.equal(f.controller.edit(),false)
 f.context={...context,portal:'secretary',userId:id(20)};assert.equal(await f.controller.load(id(10),true),false);assert.equal(f.controller.state.phase,'denied')
})
test('lost save response stays unknown and cannot blindly resend or invent acknowledgement',async()=>{
 const f=fixture();let writes=0;f.port.save=async()=>{writes++;throw new Error('Uncertain response')};await f.controller.load(id(10));f.controller.edit();f.controller.state.draft.note.sections[0].text='Synthetic unsent note';assert.equal(await f.controller.save(),false);assert.equal(f.controller.state.outcome,'unknown');assert.equal(await f.controller.save(),false);assert.equal(await f.controller.load(id(10)),false);assert.equal(writes,1);assert.equal(f.controller.state.draft.note.sections[0].text,'Synthetic unsent note')
})
test('web finalization racing a native save preserves the draft and surfaces conflict',async()=>{
 const f=fixture();await f.controller.load(id(10));f.controller.edit();f.controller.state.draft.note.sections[0].text='Synthetic local draft';f.port.save=async()=>{throw{code:'40001'}};assert.equal(await f.controller.save(),false);assert.equal(f.controller.state.outcome,'conflict');assert.equal(f.controller.state.draft.note.sections[0].text,'Synthetic local draft');assert.equal(await f.controller.save(),false)
 f.record={...record(),encounter:{...record().encounter,status:'finalized',version:2}};assert.equal(await f.controller.load(id(10),true),true);assert.equal(f.controller.edit(),false);assert.equal(f.controller.state.outcome,'idle')
})
test('background or account clearing aborts an in-flight save and rejects a late acknowledgement',async()=>{
 const f=fixture(),d=deferred();let signal;await f.controller.load(id(10));f.controller.edit();f.port.save=async(_context,_id,_version,_snapshot,_key,s)=>{signal=s;return d.promise};const saving=f.controller.save();f.controller.clear();f.context={...context,sessionId:id(30)};d.resolve(receipt());assert.equal(await saving,false);assert.equal(signal.aborted,true);assert.equal(f.controller.state.outcome,'idle');assert.equal(f.controller.state.detail,null);assert.equal(f.controller.state.draft,null)
})
test('relaunch starts without an intent and loads current server state before any edit',async()=>{
 const f=fixture();f.record={...record(),encounter:{...record().encounter,status:'finalized',version:2}};assert.equal(await f.controller.save(),false);await f.controller.load(id(10));assert.equal(f.controller.edit(),false);assert.equal(f.calls,0)
})
test('wrong acknowledgement ID/version or professional/live flags never count as saved',async()=>{
 for(const patch of [{encounter_id:id(99)},{version:1},{clinical_approval:true},{live_prescribing:true}]){
  const f=fixture();await f.controller.load(id(10));f.controller.edit();f.port.save=async()=>({...receipt(),...patch});assert.equal(await f.controller.save(),false);assert.equal(f.controller.state.outcome,'unknown');assert.ok(f.controller.state.draft)
 }
})
test('fresh reads reject foreign doctor/scope and delayed prior-session details',async()=>{
 const f=fixture();f.record={...record(),encounter:{...record().encounter,responsible_doctor:id(99)}};assert.equal(await f.controller.load(id(10)),false);assert.equal(f.controller.state.detail,null)
 const d=deferred();f.port.detail=async()=>d.promise;const reading=f.controller.load(id(10));f.controller.clear();f.context={...context,sessionId:id(50)};d.resolve(record());assert.equal(await reading,false);assert.equal(f.controller.state.detail,null)
})
