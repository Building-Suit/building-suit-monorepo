import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyClinicalSnapshot,validClinicalSnapshot} from '@building-suit/contracts'
import {nativePrescriptionFields,nativePrescriptionSnapshot,emptyNativePrescription,emptyNativePrescriptionSegment} from '../../mobile/doctor/app/utils/nativePrescriptionFields.ts'
import {clinicalFields,clinicalSnapshotFromFields} from '../../app/utils/clinicalPresentation.ts'
const id=n=>'d4070000-0000-4000-8000-'+String(n).padStart(12,'0')
function fixture(){
 const snapshot=emptyClinicalSnapshot();snapshot.note.sections[0].text='Synthetic entered review, not actual care.'
 snapshot.intake=[{id:id(1),kind:'allergy',knowledge:'unknown',text:'',value:'',unit:'',source:'patient'}]
 const segment=(kind,start,end,fields)=>({kind,start_date:start,end_date:end,timezone:'Africa/Cairo',interval_minutes:null,weekdays:[],times:[],instructions:'Synthetic entered instructions',...fields})
 snapshot.prescriptions=[{id:id(2),medicine:{identity:'synthetic-manual-fixture',label:'Synthetic entered medicine',provenance:'synthetic_manual',source_version:'manual-synthetic-v1',strength:'Synthetic strength',form:'Synthetic form'},dose:{amount:'0.250000',unit:'synthetic-unit',route:'synthetic-route'},start_date:'2026-10-01',end_date:'2026-10-14',segments:[segment('interval','2026-10-01','2026-10-09',{interval_minutes:480,times:['08:00']}),segment('weekdays','2026-10-10','2026-10-12',{weekdays:[1,3,5],times:['08:00','20:00']}),segment('as_needed','2026-10-13','2026-10-14',{})],instructions:'Synthetic manual instructions only'}]
 return snapshot
}
test('new native prescription and segment fields contain no default dose, route, schedule or timezone',()=>{
 const value=emptyNativePrescription(id(10));assert.equal(value.id,id(10));assert.deepEqual(value.segments,[]);for(const [key,field]of Object.entries(value))if(!['id','segments'].includes(key))assert.equal(field,'')
 for(const value of Object.values(emptyNativePrescriptionSegment()))assert.equal(value,'')
})
test('native and web structured fields use identical M2 contracts and preserve the full entered snapshot',()=>{
 const snapshot=fixture();assert.equal(validClinicalSnapshot(snapshot),true);const fields=nativePrescriptionFields(snapshot,id(20));assert.deepEqual(fields,clinicalFields(snapshot,id(20)));assert.deepEqual(nativePrescriptionSnapshot(fields),snapshot);assert.deepEqual(nativePrescriptionSnapshot(fields),clinicalSnapshotFromFields(fields))
})
test('as-needed segments retain no clock schedule and decimal dose strings stay exact',()=>{
 const fields=nativePrescriptionFields(fixture()),result=nativePrescriptionSnapshot(fields),asNeeded=result.prescriptions[0].segments[2]
 assert.equal(result.prescriptions[0].dose.amount,'0.250000');assert.equal(asNeeded.kind,'as_needed');assert.equal(asNeeded.interval_minutes,null);assert.deepEqual(asNeeded.times,[]);assert.deepEqual(asNeeded.weekdays,[]);assert.equal(asNeeded.timezone,'Africa/Cairo');assert.equal(result.prescriptions[0].medicine.provenance,'synthetic_manual')
})
test('overlap, missing timezone and malformed manual schedules are rejected without correction',()=>{
 for(const change of [field=>{field.segments[1].start='2026-10-09'},field=>{field.segments[0].timezone=''},field=>{field.segments[0].interval='not-a-number'},field=>{field.segments[2].times='08:00'}]){
  const fields=nativePrescriptionFields(fixture());change(fields.prescriptions[0]);assert.equal(nativePrescriptionSnapshot(fields),null)
 }
})
test('editing a prescription preserves unknown intake separately from an explicit none-reported entry',()=>{
 for(const knowledge of ['unknown','none_reported']){
  const snapshot=fixture();snapshot.intake[0].knowledge=knowledge;const fields=nativePrescriptionFields(snapshot);fields.prescriptions[0].instructions='Synthetic amended instructions';const result=nativePrescriptionSnapshot(fields);assert.equal(result.intake[0].knowledge,knowledge);assert.equal(result.note.sections[0].text,snapshot.note.sections[0].text)
 }
})
test('missing or invalid dose fields never produce recommendations or replacement values',()=>{
 for(const amount of ['','0','-1','1/2','abc']){const fields=nativePrescriptionFields(fixture());fields.prescriptions[0].amount=amount;assert.equal(nativePrescriptionSnapshot(fields),null);assert.equal(fields.prescriptions[0].amount,amount)}
})

const {createNativePrescriptionReview}=await import('../../mobile/doctor/app/utils/nativePrescriptionReview.ts')
const {createHash}=await import('node:crypto')
const context={contractVersion:1,product:'doctor-suit',dataMode:'synthetic',environment:'local',portal:'doctor',userId:id(100),sessionId:id(101),doctorId:id(100),practiceId:id(102),locationId:id(103),grantsVersion:1,locationVersion:1,capabilities:['patients.read']}
function detail(revision=1,status='in_progress'){
 const snapshot=fixture(),canonical=JSON.stringify(snapshot)
 return{encounter:{id:id(110),practice_id:context.practiceId,location_id:context.locationId,responsible_doctor:context.doctorId,patient_id:id(120),status,version:revision},versions:[{id:id(130+revision),revision,kind:status,snapshot,canonical_snapshot:canonical,snapshot_sha256:createHash('sha256').update(canonical).digest('hex'),version_status:status==='finalized'?'active':'draft',synthetic_attestation:true,professional_signature:false}],data_mode:'synthetic',clinical_approval:false,live_prescribing:false}
}
const receipt=(status='finalized',version=2)=>({encounter_id:id(110),version,version_id:id(130+version),status,release_id:null,data_mode:'synthetic',clinical_approval:false,live_prescribing:false})
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{resolve,reject,promise}}
function reviewFixture(){
 let selected=context,current=detail(),fresh=current,caps=['read','draft','sign'],clock=1000,draft=false,clears=0,finalizeCalls=0
 const calls=[]
 const port={directory:async()=>({available:true,rows:[],patients:[],total:0,capabilities:caps,data_mode:'synthetic',clinical_approval:false,live_prescribing:false}),detail:async()=>fresh,start:async()=>receipt('in_progress'),finalize:async(...args)=>{finalizeCalls++;calls.push(args);return receipt()}}
 const review=createNativePrescriptionReview(port,()=>selected,()=>current,value=>{current=value;return true},()=>{clears++},()=>draft,{now:()=>clock,key:()=>id(199)})
 return{review,port,calls,set context(value){selected=value},set fresh(value){fresh=value},set current(value){current=value},get current(){return current},set caps(value){caps=value},set clock(value){clock=value},set draft(value){draft=value},get clears(){return clears},get finalizeCalls(){return finalizeCalls}}
}
test('synthetic finalization requires an explicit current review and pins its immutable version/hash once',async()=>{
 const f=reviewFixture(),version=f.current.versions[0];assert.equal(await f.review.finalize(),false);assert.equal(await f.review.prepare(version.id),true);assert.equal(f.finalizeCalls,0)
 assert.equal(await f.review.finalize(),true);assert.equal(f.review.state.phase,'acknowledged');assert.equal(f.review.state.result.clinical_approval,false);assert.equal(f.calls[0][2],1);assert.equal(f.calls[0][3],version.id);assert.equal(f.calls[0][4],version.snapshot_sha256);assert.equal(await f.review.finalize(),false);assert.equal(f.finalizeCalls,1)
})
test('web amendment before review prevents confirmation and exposes the fresh server revision',async()=>{
 const f=reviewFixture(),old=f.current.versions[0].id;f.fresh=detail(2,'amended');assert.equal(await f.review.prepare(old),false);assert.equal(f.review.state.phase,'stale');assert.equal(f.review.state.target,null);assert.equal(f.current.encounter.version,2);assert.equal(f.finalizeCalls,0)
})
test('web amendment after review surfaces a version conflict without creating a synthetic final version',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);let writes=0;f.port.finalize=async()=>{writes++;throw{code:'40001'}};assert.equal(await f.review.finalize(),false);assert.equal(f.review.state.phase,'stale');assert.equal(f.review.state.target,null);assert.equal(await f.review.finalize(),false);assert.equal(writes,1)
})
test('secretary, offline/null context and replaced session cannot finalize a cached review',async()=>{
 for(const change of [null,{...context,portal:'secretary',userId:id(200)},{...context,sessionId:id(201)}]){
  const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);f.context=change;assert.equal(await f.review.finalize(),false);assert.equal(f.finalizeCalls,0);assert.equal(f.review.state.target,null)
 }
})
test('revoked signing permission is freshly checked and clears protected review state before any command',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);f.caps=['read'];assert.equal(await f.review.finalize(),false);assert.equal(f.review.state.phase,'denied');assert.equal(f.review.state.target,null);assert.equal(f.clears,1);assert.equal(f.finalizeCalls,0)
})
test('expired reviews and newly edited drafts require another explicit review',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);f.clock=31000;assert.equal(await f.review.finalize(),false);assert.equal(f.review.state.phase,'expired');assert.equal(f.finalizeCalls,0)
 const edited=reviewFixture();await edited.review.prepare(edited.current.versions[0].id);edited.draft=true;assert.equal(await edited.review.finalize(),false);assert.equal(edited.review.state.target,null);assert.equal(edited.finalizeCalls,0)
})
test('unknown finalization never replays or invents acknowledgement',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);let writes=0;f.port.finalize=async()=>{writes++;throw new Error('Uncertain response')};assert.equal(await f.review.finalize(),false);assert.equal(f.review.state.phase,'unknown');assert.equal(f.review.state.result,null);assert.equal(await f.review.finalize(),false);assert.equal(await f.review.prepare(f.current.versions[0].id),false);assert.equal(writes,1)
})
test('background/session clearing retires delayed review reads and their abort signal',async()=>{
 const f=reviewFixture(),d=deferred();let signal;f.port.detail=async(_scope,_id,value)=>{signal=value;return d.promise};const preparing=f.review.prepare(f.current.versions[0].id);await new Promise(resolve=>setImmediate(resolve));f.review.clear();f.context=null;d.resolve(detail());assert.equal(await preparing,false);assert.equal(signal.aborted,true);assert.equal(f.review.state.phase,'idle');assert.equal(f.review.state.target,null)
})
test('stopped/amended server revisions invalidate ready review and refresh the visible source',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);const stopped=detail(2,'amended');stopped.versions[0].snapshot.prescriptions=[];stopped.versions[0].canonical_snapshot=JSON.stringify(stopped.versions[0].snapshot);stopped.versions[0].snapshot_sha256=createHash('sha256').update(stopped.versions[0].canonical_snapshot).digest('hex');f.fresh=stopped;assert.equal(await f.review.revalidate(),true);assert.equal(f.review.state.phase,'stale');assert.equal(f.current.encounter.version,2);assert.deepEqual(f.current.versions[0].snapshot.prescriptions,[]);assert.equal(await f.review.finalize(),false);assert.equal(f.finalizeCalls,0)
})
test('professional-signature claims cannot become a mobile synthetic acknowledgement',async()=>{
 const f=reviewFixture();await f.review.prepare(f.current.versions[0].id);f.port.finalize=async()=>({...receipt(),professional_signature:true});assert.equal(await f.review.finalize(),false);assert.equal(f.review.state.phase,'unknown');assert.equal(f.review.state.result,null)
 const claimed=reviewFixture(),value=detail();value.versions[0].professional_signature=true;claimed.fresh=value;assert.equal(await claimed.review.prepare(claimed.current.versions[0].id),false);assert.equal(claimed.finalizeCalls,0)
})
test('starting an encounter cannot replay an unknown or acknowledged command before fresh loading',async()=>{
 const f=reviewFixture();f.current=detail(1,'draft');f.fresh=f.current;let starts=0;f.port.start=async()=>{starts++;return receipt('in_progress')};assert.equal(await f.review.start(),true);assert.equal(await f.review.start(),false);assert.equal(starts,1)
 const unknown=reviewFixture();unknown.current=detail(1,'draft');unknown.fresh=unknown.current;unknown.port.start=async()=>{starts++;throw new Error('Uncertain')};assert.equal(await unknown.review.start(),false);assert.equal(unknown.review.state.phase,'unknown');assert.equal(await unknown.review.start(),false);assert.equal(starts,2)
})
test('observed web updates preserve a local draft, mark conflict and never regress to a late older record',async()=>{
 const {createNativeEncounter}=await import('../../mobile/doctor/app/utils/nativeEncounter.ts');let saves=0
 const service=createNativeEncounter({detail:async()=>detail(),save:async()=>{saves++;return receipt()}},()=>context)
 await service.load(id(110));assert.equal(service.edit(),true);service.state.draft.note.sections[0].text='Synthetic local unsent text'
 const catalogue=await reviewFixture().port.directory();assert.equal(service.observe(detail(2,'finalized'),catalogue),true);assert.equal(service.state.outcome,'conflict');assert.equal(service.state.draft.note.sections[0].text,'Synthetic local unsent text');assert.equal(service.state.detail.encounter.version,2);assert.equal(service.observe(detail(1),catalogue),false);assert.equal(service.state.detail.encounter.version,2);assert.equal(await service.save(),false);assert.equal(saves,0)
})
test('native amendment and withdrawal require pinned final versions, explicit reasons and fresh distinct grants',async()=>{
 for(const action of ['amend','withdraw']){
  const f=reviewFixture();f.current=detail(1,'finalized');f.fresh=f.current;f.caps=['read','draft','sign','review'];let command
  f.port.transition=async(_context,target,version,kind,reason)=>{command={target,version,kind,reason};return receipt(kind==='amend'?'amended':'withdrawn')}
  assert.equal(await f.review.transition(action,id(110),1,''),false);assert.equal(await f.review.transition(action,id(110),1,'Synthetic explicit correction reason'),true);assert.deepEqual(command,{target:id(110),version:1,kind:action,reason:'Synthetic explicit correction reason'});assert.equal(await f.review.transition(action,id(110),1,'Duplicate intent'),false)
 }
 const revoked=reviewFixture();revoked.current=detail(1,'finalized');revoked.fresh=revoked.current;revoked.caps=['read','sign'];revoked.port.transition=()=>assert.fail('amendment requires review grant');assert.equal(await revoked.review.transition('amend',id(110),1,'Synthetic correction'),false);assert.equal(revoked.review.state.phase,'denied')
})
test('a web update during an amendment confirmation prevents a stale transition',async()=>{
 const f=reviewFixture();f.current=detail(1,'finalized');f.fresh=detail(2,'amended');f.caps=['read','review'];f.port.transition=()=>assert.fail('stale record must not mutate');assert.equal(await f.review.transition('amend',id(110),1,'Synthetic correction'),false);assert.equal(f.review.state.phase,'stale');assert.equal(f.current.encounter.version,2)
})
test('native finalization repository sends the exact reviewed immutable ID/hash and current server version',async()=>{
 const {createNativeEncounterRepository}=await import('../../mobile/doctor/app/utils/nativeEncounterRepository.ts')
 const requests=[],choice={context,practiceName:'Synthetic',doctorName:'Synthetic',locationName:'Synthetic'},sha=detail().versions[0].snapshot_sha256
 const configuration={url:'http://127.0.0.1:65321',accountUrl:'http://127.0.0.1:4342',publicKey:'sb_publishable_synthetickeyonly',environment:'local',dataMode:'synthetic'}
 const repository=createNativeEncounterRepository(configuration,async request=>{requests.push(request);return{status:200,data:request.url.endsWith('/doctor_clinical_workspace')?{available:true,rows:[],patients:[],total:0,capabilities:['read','sign'],data_mode:'synthetic',clinical_approval:false,live_prescribing:false}:receipt()}},{identity:()=>({userId:context.userId,sessionId:context.sessionId,environment:'local'}),accessToken:()=> 'synthetic-current-token'},()=>choice,{resolve:async value=>value},()=>{})
 await repository.finalize(context,id(110),1,id(131),sha,id(199),new AbortController().signal)
 assert.equal(requests.length,2);assert.deepEqual(requests[1].body,{p_encounter:id(110),p_expected_version:1,p_action:'finalize',p_input:{reviewed_version_id:id(131),reviewed_sha256:sha},p_key:id(199),p_practice:context.practiceId,p_location:context.locationId});assert.equal('professional_signature'in requests[1].body.p_input,false)
})
test('incomplete clinical content blocks final review without inserting a replacement note',async()=>{
 const f=reviewFixture(),value=detail();value.versions[0].snapshot.note.sections[0].text='';value.versions[0].canonical_snapshot=JSON.stringify(value.versions[0].snapshot);value.versions[0].snapshot_sha256=createHash('sha256').update(value.versions[0].canonical_snapshot).digest('hex');f.current=value;f.fresh=value;assert.equal(await f.review.prepare(value.versions[0].id),false);assert.equal(f.review.state.phase,'invalid');assert.equal(value.versions[0].snapshot.note.sections[0].text,'');assert.equal(f.finalizeCalls,0)
})
