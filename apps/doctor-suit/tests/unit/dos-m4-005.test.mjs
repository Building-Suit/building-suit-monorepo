import test from 'node:test'
import assert from 'node:assert/strict'
import {createNativePatients,nativePatientScopeKey} from '../../mobile/doctor/app/utils/nativePatients.ts'
const id=n=>'d4050000-0000-4000-8000-'+String(n).padStart(12,'0')
const context={contractVersion:1,product:'doctor-suit',dataMode:'synthetic',environment:'local',portal:'secretary',userId:id(1),sessionId:id(2),doctorId:id(3),practiceId:id(4),locationId:id(5),grantsVersion:1,locationVersion:1,capabilities:['patients.read']}
const query={page:0,size:25,search:'',status:'active'},directory={rows:[],total:0,canWrite:false}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise}}
function fixture(){let current=context;const port={directory:async()=>directory,profile:async()=>({patient:{id:id(9)}})};const patients=createNativePatients(port,()=>current);return{patients,port,set context(v){current=v}}}
test('read-only native lookup respects permission and passes bounded query unchanged',async()=>{
 const f=fixture();let captured;f.port.directory=async(_context,q)=>{captured=q;return directory};assert.equal(await f.patients.directory({...query,search:'اسم اصطناعي'}),true);assert.equal(captured.search,'اسم اصطناعي');assert.deepEqual(f.patients.state.directory,directory)
 f.context={...context,capabilities:[]};assert.equal(await f.patients.directory(query),false);assert.equal(f.patients.state.directory,null);assert.equal(f.patients.state.phase,'denied')
})
test('account/location switch and revoked grants reject delayed directory results',async()=>{
 for(const change of [{sessionId:id(20)},{locationId:id(21)},{grantsVersion:2,capabilities:[]}]){
  const f=fixture(),d=deferred();f.port.directory=async()=>d.promise;const load=f.patients.directory(query);f.context={...context,...change};f.patients.clear();d.resolve(directory);assert.equal(await load,false);assert.equal(f.patients.state.directory,null)
 }
})
test('new searches abort old work and cannot display old rows',async()=>{
 const f=fixture(),d=deferred();let signal;f.port.directory=async(_context,q,s)=>{if(q.search==='old'){signal=s;return d.promise}return directory}
 const old=f.patients.directory({...query,search:'old'});assert.equal(await f.patients.directory({...query,search:'new'}),true);d.resolve({rows:[{name:'stale'}],total:1,canWrite:false});assert.equal(await old,false);assert.equal(signal.aborted,true);assert.deepEqual(f.patients.state.directory,directory)
})
test('offline/denial clears previously displayed profile and no request retries occur',async()=>{
 const f=fixture();await f.patients.profile(id(9));assert.ok(f.patients.state.profile);let calls=0;f.port.profile=async()=>{calls++;throw{code:'42501'}};assert.equal(await f.patients.profile(id(9)),false);assert.equal(calls,1);assert.equal(f.patients.state.profile,null);assert.equal(f.patients.state.phase,'denied')
})
test('invalid page/search/profile input never reaches the provider',async()=>{
 const f=fixture();let calls=0;f.port.directory=async()=>{calls++;return directory};for(const invalid of [{page:-1},{size:10000},{search:'x'.repeat(161)},{status:'clinical'}])assert.equal(await f.patients.directory({...query,...invalid}),false);assert.equal(calls,0);assert.equal(await f.patients.profile('https://private.invalid'),false)
})
test('scope key isolates all authority dimensions without contact-based identity',()=>{
 const key=nativePatientScopeKey(context);for(const change of [{userId:id(30)},{sessionId:id(31)},{doctorId:id(32)},{practiceId:id(33)},{locationId:id(34)},{grantsVersion:2},{locationVersion:2},{portal:'doctor'},{capabilities:[]}])assert.notEqual(nativePatientScopeKey({...context,...change}),key)
})

const {createNativePatientsRepository}=await import('../../mobile/doctor/app/utils/nativePatientsRepository.ts')
const config={url:'http://127.0.0.1:65321',accountUrl:'http://127.0.0.1:4342',publicKey:'sb_publishable_synthetickeyonly',environment:'local',dataMode:'synthetic'}
const dto=n=>({id:id(n),practice_id:context.practiceId,patient_identity_id:id(n+1),name:n===100?'Synthetic patient':'مريض اصطناعي',phone:'synthetic-shared-contact',email:'shared@example.test',date_of_birth:null,created_location_id:context.locationId,created_by:context.userId,created_at:'2026-10-23T00:00:00Z',updated_at:'2026-10-23T00:00:00Z',archived_at:null,version:1,provenance:'entered_unverified'})
function repository(transport,resolve=async choice=>choice){const choice={context,practiceName:'Synthetic',doctorName:'Synthetic',locationName:'Synthetic'};return createNativePatientsRepository(config,transport,{identity:()=>({userId:context.userId,sessionId:context.sessionId,environment:'local'}),accessToken:()=> 'synthetic-current-token'},()=>choice,{resolve},()=>{})}
test('same-contact patient relationships remain distinct with Arabic names and current scope',async()=>{
 const requests=[],port=repository(async request=>{requests.push(request);return{status:200,data:{rows:[dto(100),dto(200)],total:2,can_write:true}}})
 const value=await port.directory(context,query,new AbortController().signal);assert.equal(value.rows.length,2);assert.notEqual(value.rows[0].identityId,value.rows[1].identityId);assert.notEqual(value.rows[0].id,value.rows[1].id);assert.equal(value.rows[1].name,'مريض اصطناعي');assert.equal(value.rows[0].phone,value.rows[1].phone)
 assert.deepEqual(requests[0].body,{p_practice:context.practiceId,p_location:context.locationId,p_page:0,p_size:25,p_search:'',p_status:'active'});assert.equal(requests[0].url.includes('synthetic-current-token'),false)
})
test('fresh server grant denial prevents directory request; foreign rows fail decoding',async()=>{
 let calls=0;const port=repository(async()=>{calls++;return{status:200,data:null}},async()=>{throw{code:'42501'}});await assert.rejects(port.directory(context,query,new AbortController().signal));assert.equal(calls,0)
 const foreign=repository(async()=>({status:200,data:{rows:[{...dto(100),practice_id:id(900)}],total:1,can_write:false}}));await assert.rejects(foreign.directory(context,query,new AbortController().signal))
})
test('private document download stays disabled without any transport call',async()=>{
 let calls=0;const port=repository(async()=>{calls++;return{status:200,data:null}});await assert.rejects(port.download(),error=>error.code==='DEVICE_POLICY_REQUIRED');assert.equal(calls,0)
})

const {doctorMobileDestination,createDoctorMobileShell}=await import('../../mobile/doctor/app/utils/mobileShell.ts')
test('native patient links accept opaque relationship paths and reject external/token/encoded input',()=>{
 assert.equal(doctorMobileDestination('/patients'),'/patients');assert.equal(doctorMobileDestination('/patients/'+id(100)),'/patients/'+id(100));assert.equal(doctorMobileDestination('doctor-suit-synthetic://patients/'+id(100)),'/patients/'+id(100))
 for(const input of ['/patients/lookup-by-email','/patients/'+id(100)+'?token=private','/patients/%2e%2e','https://private.invalid/patients/'+id(100)])assert.equal(doctorMobileDestination(input),null)
})
test('patient deep-link shell revalidates server scope and denies missing patient-read permission',async()=>{
 const selection={doctorId:context.doctorId,practiceId:context.practiceId,locationId:context.locationId},actor={userId:context.userId,sessionId:context.sessionId,environment:'local'}
 let capabilities=[];const shell=createDoctorMobileShell({identity:()=>actor,selection:()=>selection,load:async()=>({...context,capabilities})})
 assert.equal(await shell.navigate('/patients/'+id(100)),false);assert.equal(shell.state.phase,'denied');assert.equal(shell.state.context,null);capabilities=['patients.read'];assert.equal(await shell.navigate('/patients/'+id(100)),true)
})
test('native patient back navigation returns profile to directory before workspace and exit',async()=>{
 const {doctorMobileBackDestination}=await import('../../mobile/doctor/app/utils/mobileShell.ts')
 assert.equal(doctorMobileBackDestination('/patients/'+id(100)),'/patients');assert.equal(doctorMobileBackDestination('/patients'),'/workspace');assert.equal(doctorMobileBackDestination('/workspace'),null);assert.equal(doctorMobileBackDestination('/unregistered'),'/workspace')
})
