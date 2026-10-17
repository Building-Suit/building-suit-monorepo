import test from'node:test'
import assert from'node:assert/strict'
import{reactive}from'vue'
import{doctorPrivacySnapshot}from'../../app/utils/privacyRequests.ts'
import{createDoctorPrivacyController,doctorPrivacyState}from'../../app/utils/privacyController.ts'
const id=n=>`ae200000-0000-0000-0000-${String(n).padStart(12,'0')}`,actor={userId:id(1),sessionId:id(11),practiceId:null}
const row={id:id(51),kind:'access_review',state:'awaiting_review',createdAt:'2026-10-17T00:00:00Z'}
const raw={id:row.id,kind:row.kind,state:row.state,created_at:row.createdAt}
const dto={user_id:actor.userId,scope:'own_account',data_mode:'synthetic',policy_configured:false,fulfillment_available:false,items:[raw]}
function setup(repo){let identity=actor;const state=reactive(doctorPrivacyState()),controller=createDoctorPrivacyController(repo,state,()=>identity,'preview',()=>id(61));return{state,controller,identity:v=>{identity=v}}}
test('decoder rejects foreign ownership, fulfillment, unknown states and unbounded/duplicate requests',()=>{
 assert.deepEqual(doctorPrivacySnapshot(dto,actor),[row]);for(const change of[{user_id:id(2)},{scope:'patient'},{policy_configured:true},{fulfillment_available:true},{items:[{...raw,state:'fulfilled'}]},{items:[raw,raw]},{items:Array(5).fill(raw)}])assert.throws(()=>doctorPrivacySnapshot({...dto,...change},actor))
})
test('unknown committed request retry retains key, coalesces duplicate clicks and refreshes authoritative rows',async()=>{
 let committed=false,release;const keys=[],{state,controller}=setup({load:async()=>committed?[row]:[],submit:async(kind,key)=>{keys.push(key);if(keys.length===1){committed=true;throw Error('Disconnected after commit')}await new Promise(r=>{release=r});return row}})
 await controller.load();assert.equal(await controller.submit(),false);assert.equal(state.error,'network');const pending=controller.submit();assert.equal(await controller.submit(),false);release();assert.equal(await pending,true);assert.deepEqual(keys,[id(61),id(61)]);assert.equal(state.items.length,1);assert.equal(state.submitted,true);assert.equal(controller.canSubmit(),false)
})
test('identity change rejects pending private reads and cached submit authority',async()=>{
 let release,writes=0;const{state,controller,identity}=setup({load:async()=>new Promise(r=>{release=r}),submit:async()=>{writes++}});const loading=controller.load();identity({...actor,userId:id(2)});release([row]);assert.equal(await loading,false);assert.equal(state.items.length,0);assert.equal(controller.canSubmit(),false);assert.equal(await controller.submit(),false);assert.equal(writes,0)
})
test('explicit clear aborts old write response without private state or feedback',async()=>{
 let release;const{state,controller}=setup({load:async()=>[],submit:async()=>new Promise(r=>{release=r})});await controller.load();const write=controller.submit();controller.clear();release(row);assert.equal(await write,false);assert.equal(state.submitted,false);assert.equal(state.ready,false);assert.equal(state.pending,false)
})
test('conflicting material requires a new load and revoked authority cannot resubmit',async()=>{
 for(const code of['40001','42501']){const{state,controller}=setup({load:async()=>[],submit:async()=>{throw{code}}});await controller.load();assert.equal(await controller.submit(),false);assert.equal(state.error,code==='40001'?'conflict':'denied');assert.equal(controller.canSubmit(),false)}
})
