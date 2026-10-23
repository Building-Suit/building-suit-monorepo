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
