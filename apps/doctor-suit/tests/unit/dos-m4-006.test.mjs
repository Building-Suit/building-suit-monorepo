import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyClinicalSnapshot} from '@building-suit/contracts'
import {createNativeEncounter} from '../../mobile/doctor/app/utils/nativeEncounter.ts'
const id=n=>'d4060000-0000-4000-8000-'+String(n).padStart(12,'0')
const context={contractVersion:1,product:'doctor-suit',dataMode:'synthetic',environment:'local',portal:'doctor',userId:id(1),sessionId:id(2),doctorId:id(1),practiceId:id(4),locationId:id(5),grantsVersion:1,locationVersion:1,capabilities:['patients.read']}
const record=()=>({encounter:{id:id(10),practice_id:context.practiceId,location_id:context.locationId,responsible_doctor:context.doctorId,status:'draft',version:1},versions:[{id:id(11),revision:1,snapshot:emptyClinicalSnapshot()}],data_mode:'synthetic',clinical_approval:false,live_prescribing:false})
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
test('new native encounters require a fresh server patient relationship and an acknowledged create',async()=>{
 const f=fixture();let calls=0;f.port.directory=async()=>({available:true,capabilities:['read','draft'],rows:[],patients:[{id:id(60),name:'Synthetic patient'}],total:0,data_mode:'synthetic',clinical_approval:false,live_prescribing:false});f.port.create=async(_context,patientId,_snapshot,_key)=>{calls++;assert.equal(patientId,id(60));return{...receipt(),version:1}}
 await f.controller.directory();assert.equal(f.controller.create(),true);assert.equal(await f.controller.save(),false);assert.equal(f.controller.patient(id(61)),false);assert.equal(f.controller.patient(id(60)),true);assert.equal(await f.controller.save(),true);assert.equal(calls,1);assert.equal(f.controller.state.acknowledgedId,id(10))
})
test('unknown create is never retried and old-scope patient choices cannot grant a new scope',async()=>{
 const f=fixture();let calls=0;f.port.directory=async()=>({available:true,capabilities:['draft'],rows:[],patients:[{id:id(60),name:'Synthetic patient'}],total:0});f.port.create=async()=>{calls++;throw new Error('Uncertain')};await f.controller.directory();f.controller.create();f.controller.patient(id(60));assert.equal(await f.controller.save(),false);assert.equal(f.controller.state.outcome,'unknown');assert.equal(await f.controller.save(),false);assert.equal(calls,1);f.controller.clear();f.context={...context,practiceId:id(90)};assert.equal(f.controller.create(),false)
})
test('viewing historical revisions cannot make old content editable as the current revision',async()=>{
 const f=fixture();f.record={...record(),encounter:{...record().encounter,version:2}};await f.controller.load(id(10));assert.equal(f.controller.edit(),false);assert.equal(await f.controller.save(),false);assert.equal(f.calls,0)
})
test('Vue reactive read state copies only validated JSON and leaves the verified source unchanged',async()=>{
 const {reactive}=await import('vue'),{nativeEncounterState}=await import('../../mobile/doctor/app/utils/nativeEncounter.ts');const f=fixture(),state=reactive(nativeEncounterState()),controller=createNativeEncounter(f.port,()=>context,state,()=>id(90))
 await controller.load(id(10));assert.equal(controller.edit(),true);state.draft.note.sections[0].text='Synthetic reactive note';assert.equal(state.detail.versions[0].snapshot.note.sections[0].text,'');assert.equal(await controller.save(),true);assert.equal(state.outcome,'acknowledged')
})

const {createNativeEncounterRepository}=await import('../../mobile/doctor/app/utils/nativeEncounterRepository.ts')
const config={url:'http://127.0.0.1:65321',accountUrl:'http://127.0.0.1:4342',publicKey:'sb_publishable_synthetickeyonly',environment:'local',dataMode:'synthetic'}
function dependencies(transport){const choice={context,practiceName:'Synthetic',doctorName:'Synthetic',locationName:'Synthetic'};return[config,transport,{identity:()=>({userId:context.userId,sessionId:context.sessionId,environment:'local'}),accessToken:()=> 'synthetic-current-token'},()=>choice,{resolve:async value=>value},()=>{}]}
test('native encounter writes require fresh server draft permission and the exact optimistic version/key',async()=>{
 const requests=[],port=createNativeEncounterRepository(...dependencies(async request=>{requests.push(request);return{status:200,data:request.url.endsWith('/doctor_clinical_workspace')?{available:true,capabilities:['read','draft'],rows:[],patients:[],total:0,data_mode:'synthetic',clinical_approval:false,live_prescribing:false}:receipt()}}))
 const snapshot=emptyClinicalSnapshot();await port.save(context,id(10),1,snapshot,id(90),new AbortController().signal)
 assert.equal(requests.length,2);assert.deepEqual(requests[1].body,{p_encounter:id(10),p_expected_version:1,p_action:'save',p_input:{snapshot},p_key:id(90),p_practice:context.practiceId,p_location:context.locationId});assert.equal(requests[1].url.includes('synthetic-current-token'),false)
})
test('missing synthetic draft grant and secretary ownership prevent a native write',async()=>{
 let writes=0;const port=createNativeEncounterRepository(...dependencies(async request=>{if(request.url.endsWith('/doctor_clinical_command'))writes++;return{status:200,data:{available:true,capabilities:['read'],rows:[],patients:[],total:0,data_mode:'synthetic',clinical_approval:false,live_prescribing:false}}}))
 await assert.rejects(port.save(context,id(10),1,emptyClinicalSnapshot(),id(90),new AbortController().signal));assert.equal(writes,0);await assert.rejects(port.directory({...context,portal:'secretary',userId:id(99)},0,'',new AbortController().signal));assert.equal(writes,0)
})
test('native server version-conflict decoding preserves a fixed code without disclosing provider details',async()=>{
 const {createNativeScopedRpc}=await import('../../mobile/doctor/app/utils/nativeScopedRpc.ts');const rpc=createNativeScopedRpc(...dependencies(async()=>({status:400,data:{code:'40001',message:'PRIVATE SENTINEL'}})))
 await assert.rejects(rpc('doctor_clinical_command',{},context,new AbortController().signal,null),error=>error.code==='40001'&&!error.message.includes('SENTINEL'))
})
test('scoped transport rejects RPC path injection and cannot override selected tenant arguments',async()=>{
 const {createNativeScopedRpc}=await import('../../mobile/doctor/app/utils/nativeScopedRpc.ts');let captured,calls=0;const rpc=createNativeScopedRpc(...dependencies(async request=>{calls++;captured=request;return{status:200,data:{}}}))
 await assert.rejects(rpc('doctor_clinical_command/other',{},context,new AbortController().signal,null));assert.equal(calls,0)
 await rpc('doctor_clinical_workspace',{p_practice:id(500),p_location:id(501)},context,new AbortController().signal,null);assert.equal(captured.body.p_practice,context.practiceId);assert.equal(captured.body.p_location,context.locationId)
})
test('authenticated native operations work without newer AbortSignal statics or crypto.randomUUID',async()=>{
 const {execFileSync}=await import('node:child_process')
 const source=`import assert from 'node:assert/strict';
 delete AbortSignal.any;delete AbortSignal.timeout;Object.defineProperty(globalThis.crypto,'randomUUID',{value:undefined,configurable:true});
 const [{createDoctorMobileShell},{createNativeEncounter},{emptyClinicalSnapshot}]=await Promise.all(process.argv.slice(1).map(path=>import(path)));
 const id=n=>'d4060000-0000-4000-8000-'+String(n).padStart(12,'0');
 const actor={userId:id(1),sessionId:id(2),environment:'local'},selection={doctorId:id(1),practiceId:id(4),locationId:id(5)};
 const context={...actor,...selection,contractVersion:1,product:'doctor-suit',dataMode:'synthetic',portal:'doctor',grantsVersion:1,locationVersion:1,capabilities:[]};
 const shell=createDoctorMobileShell({identity:()=>actor,selection:()=>selection,load:async()=>context});assert.equal(await shell.navigate('/workspace'),true);shell.dispose();
 let commandKey;const record={encounter:{id:id(10),practice_id:id(4),location_id:id(5),responsible_doctor:id(1),status:'draft',version:1},versions:[{id:id(11),revision:1,snapshot:emptyClinicalSnapshot()}],data_mode:'synthetic',clinical_approval:false,live_prescribing:false};
 const service=createNativeEncounter({detail:async()=>record,save:async(_ctx,_id,_version,_snapshot,key)=>{commandKey=key;return{encounter_id:id(10),version:2,version_id:id(12),status:'draft',release_id:null,data_mode:'synthetic',clinical_approval:false,live_prescribing:false}}},()=>context);
 assert.equal(await service.load(id(10)),true);assert.equal(service.edit(),true);assert.equal(await service.save(),true);assert.match(commandKey,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);service.dispose();`
 execFileSync(process.execPath,['--input-type=module','--eval',source,new URL('../../mobile/doctor/app/utils/mobileShell.ts',import.meta.url).href,new URL('../../mobile/doctor/app/utils/nativeEncounter.ts',import.meta.url).href,new URL('../../../../packages/contracts/src/doctorClinical.ts',import.meta.url).href],{stdio:'pipe'})
})
test('portable native deadlines preserve parent cancellation and expire without cancelling the parent',async()=>{
 const {nativeOperationSignal}=await import('../../mobile/doctor/app/utils/nativeWebCapabilities.ts')
 const parent=new AbortController(),signal=nativeOperationSignal(parent.signal,1000);parent.abort();assert.equal(signal.aborted,true)
 const active=new AbortController(),deadline=nativeOperationSignal(active.signal,10);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(deadline.aborted,true);assert.equal(active.signal.aborted,false);assert.equal(nativeOperationSignal(parent.signal).aborted,true)
 assert.throws(()=>nativeOperationSignal(active.signal,0))
})
test('an explicit server amendment draft is editable while finalized content remains immutable',async()=>{
 const f=fixture();f.record={...record(),encounter:{...record().encounter,status:'amended'}};f.port.save=async()=>({...receipt(),status:'amended'});await f.controller.load(id(10));assert.equal(f.controller.edit(),true);assert.equal(await f.controller.save(),true)
})
