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
