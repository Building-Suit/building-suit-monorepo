import test from 'node:test'
import assert from 'node:assert/strict'
import {reactive}from'vue'
import {doctorTeamDirectory,doctorTeamCanAllocate,doctorTeamCanChangeGrants}from'../../app/utils/delegation.ts'
import {doctorLocationDirectory}from'../../app/utils/locations.ts'
import {createDoctorTeamController,doctorTeamState}from'../../app/utils/teamController.ts'
import {createDoctorLocationsController,doctorLocationsState}from'../../app/utils/locationsController.ts'
const id=n=>`ae160000-0000-0000-0000-${String(n).padStart(12,'0')}`
const epoch=Date.parse('2026-10-17T00:00:00Z')
const rawEntitlement=(change={})=>({state:'trial',revision:1,writes_allowed:true,can_add_staff:true,can_add_clinic:true,over_limit:false,valid_until:new Date(epoch+10000).toISOString(),observed_at:new Date(epoch).toISOString(),...change})
const historical=()=>rawEntitlement({state:'expired',writes_allowed:false,can_add_staff:false,can_add_clinic:false,observed_at:new Date(epoch+10000).toISOString()})
const rawTeam=(entitlement=rawEntitlement())=>({practice_id:id(21),practice_name:'Synthetic owner',edition:'administrative_candidate',edition_revision:2,entitlement,available_capabilities:['patients.read','patients.write'],members:[],invitations:[],locations:[{id:id(31),name:'Synthetic archived clinic',timezone:'Etc/UTC',archived:true}],member_total:0,invitation_total:0,location_total:1})
const rawLocations=(entitlement=rawEntitlement())=>({edition:'administrative_candidate',entitlement,practice_name:'Synthetic owner',total:1,can_create:entitlement.can_add_clinic,rows:[{id:id(31),practice_id:id(21),name:'Synthetic clinic',timezone:'Etc/UTC',contact_phone:'',contact_address:'',archived_at:null,version:1,can_manage:true,can_edit:entitlement.writes_allowed}]})
const scope={environment:'local',portal:'doctor',userId:id(1),sessionId:id(11),practiceId:id(21),locationId:null,grantsVersion:0}
const flush=async()=>{for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve))}
function clock(){let now=0,next=0;const jobs=new Map();return{now:()=>now,set(callback,delay){const key=++next;jobs.set(key,{callback,due:now+delay});return key},clear(key){jobs.delete(key)},callbacks:()=>[...jobs.values()].map(x=>x.callback),next:()=>Math.min(...[...jobs.values()].map(x=>x.due)),advance(ms){now+=ms;for(const[key,job]of[...jobs])if(job.due<=now){jobs.delete(key);job.callback()}}}}
test('candidate team and clinic offers require valid bounded metadata',()=>{
  const missing=rawTeam();delete missing.entitlement;assert.throws(()=>doctorTeamDirectory(missing,id(21)),/ENTITLEMENT/)
  assert.throws(()=>doctorTeamDirectory(rawTeam(),id(22)),/RESPONSE_INVALID/)
  const allocation=rawLocations(historical());allocation.can_create=true;assert.throws(()=>doctorLocationDirectory(allocation,id(21)),/RESPONSE_INVALID/)
  const edit=rawLocations(historical());edit.rows[0].can_edit=true;assert.throws(()=>doctorLocationDirectory(edit,id(21)),/RESPONSE_INVALID/)
  const incomplete=rawLocations();delete incomplete.rows[0].can_edit;assert.throws(()=>doctorLocationDirectory(incomplete,id(21)),/RESPONSE_INVALID/)
})
test('subscription policy separates allocation, ordinary edits and security reductions',()=>{
  const before=[{locationId:id(31),capabilities:['patients.read','patients.write']}]
  const reduced=[{locationId:id(31),capabilities:['patients.read']}]
  const expansion=[...before,{locationId:id(32),capabilities:['patients.read']}]
  const expired=doctorTeamDirectory(rawTeam(historical()),id(21));assert.equal(doctorTeamCanAllocate(expired),false)
  assert.equal(doctorTeamCanChangeGrants(expired,before,reduced),true);assert.equal(doctorTeamCanChangeGrants(expired,before,[]),true)
  assert.equal(doctorTeamCanChangeGrants(expired,before,expansion),false)
  const atCap=doctorTeamDirectory(rawTeam(rawEntitlement({can_add_staff:false})),id(21))
  assert.equal(doctorTeamCanAllocate(atCap),false);assert.equal(doctorTeamCanChangeGrants(atCap,before,expansion),true)
  const locations=doctorLocationDirectory(rawLocations(historical()),id(21));assert.equal(locations.canCreate,false);assert.equal(locations.rows[0].canManage,true);assert.equal(locations.rows[0].canEdit,false)
})
test('reactive owner team expires without any active clinic, clears drafts and reloads historical authority',async()=>{
  const timers=clock();let raw=rawTeam();const state=reactive(doctorTeamState());let reads=0
  const team=createDoctorTeamController({load:async()=>{reads++;return doctorTeamDirectory(raw,id(21))}},state,()=>scope,undefined,undefined,timers)
  await team.load({page:0,size:20,search:''});let draft='Synthetic pending secret';team.registerPolicyChange(()=>{draft=''})
  raw=rawTeam(historical());timers.advance(10000);assert.equal(state.directory,null);assert.equal(draft,'')
  await flush();assert.equal(state.directory.entitlement.state,'expired');assert.equal(doctorTeamCanAllocate(state.directory),false);assert.equal(team.available(),true);assert.equal(reads,2)
})
test('reactive clinic expiry retains archive/history rights and rejects stale queued deadlines',async()=>{
  const timers=clock();let raw=rawLocations();const state=reactive(doctorLocationsState())
  const clinics=createDoctorLocationsController({load:async()=>doctorLocationDirectory(raw,id(21))},state,()=>scope,undefined,timers)
  await clinics.load({page:0,size:20,search:''});const stale=timers.callbacks()[0];let draft='Synthetic clinic draft';clinics.registerPolicyChange(()=>{draft=''})
  timers.advance(1000);raw=rawLocations(rawEntitlement({observed_at:new Date(epoch+1000).toISOString()}));await clinics.load({page:0,size:20,search:''});stale()
  assert.equal(draft,'Synthetic clinic draft');assert.equal(timers.next(),10000)
  raw=rawLocations(historical());timers.advance(9000);assert.equal(state.directory,null);assert.equal(draft,'');await flush()
  assert.equal(state.directory.rows[0].canManage,true);assert.equal(state.directory.rows[0].canEdit,false);assert.equal(state.directory.canCreate,false)
})
test('owner read-model expiry never regrants a failed network response',async()=>{
  const timers=clock();const state=reactive(doctorTeamState());let failed=false
  const team=createDoctorTeamController({load:async()=>{if(failed)throw Error('Synthetic offline');return doctorTeamDirectory(rawTeam(),id(21))}},state,()=>scope,undefined,undefined,timers)
  await team.load({page:0,size:20,search:''});failed=true;timers.advance(10000);await flush()
  assert.equal(state.directory,null);assert.equal(state.error,'network');assert.equal(team.available(),false)
})
test('computed team state invalidates editors without rewriting role permissions',async()=>{
  let raw=rawTeam();const state=reactive(doctorTeamState());const team=createDoctorTeamController({load:async()=>doctorTeamDirectory(raw,id(21))},state,()=>scope)
  await team.load({page:0,size:20,search:''});let clears=0;team.registerPolicyChange(()=>{clears++})
  raw=rawTeam(rawEntitlement({observed_at:new Date(epoch+1000).toISOString()}));await team.load({page:0,size:20,search:''});assert.equal(clears,0)
  raw=rawTeam(historical());await team.load({page:0,size:20,search:''});assert.equal(clears,1);assert.deepEqual([...state.directory.availableCapabilities],['patients.read','patients.write'])
})
