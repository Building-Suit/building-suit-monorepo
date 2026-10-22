import test from 'node:test'
import assert from 'node:assert/strict'
import {availabilityProtocol,instant} from '../fixtures/availability-provider.mjs'
import {doctorAvailability} from '../../app/utils/availability.ts'
const id=n=>`ae340000-0000-4000-8000-${String(n).padStart(12,'0')}`
function fixture(){
 const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10),practice=id(1),location=id(2),doctor=id(3)
 const original={id:id(4),practice_id:practice,location_id:location,doctor_user_id:doctor,state:'booked',starts_at:instant(day,540,'Etc/UTC'),ends_at:instant(day,560,'Etc/UTC')}
 const other={...original,id:id(5),starts_at:instant(day,560,'Etc/UTC'),ends_at:instant(day,580,'Etc/UTC')}
 const data={locations:[{id:location,practice_id:practice,timezone:'Etc/UTC',version:1,archived_at:null}],practices:[{id:practice,owner_user_id:doctor}],appointmentRows:[original],scheduleCommitments:[original,other],scheduleRules:{[location]:{slot_minutes:20,weekly:Array.from({length:7},(_,weekday)=>({weekday,start:540,end:600})),exceptions:[],version:1}}}
 let permitted=true
 function call(input={},rpc='doctor_consultation_availability'){
  let result,status=200
  assert.equal(availabilityProtocol({data,actor:{id:doctor},rpc,input:{p_practice:practice,p_location:location,p_day:day,p_appointment:original.id,p_type:null,p_version:null,...input},send:(value,code=200)=>{result=value;status=code},capability:()=>permitted}),true)
  return{result,status}
 }
 return{day,practice,location,data,original,call,revoke:()=>{permitted=false}}
}
test('legacy reschedule protocol returns a real decoder-compatible snapshot and excludes only its own appointment',()=>{
 const f=fixture(),reply=f.call();assert.equal(reply.status,200);assert.equal(reply.result.consultation,null)
 const decoded=doctorAvailability(reply.result,f.practice,f.location,f.day)
 assert.equal(decoded.slots[0].available,true);assert.equal(decoded.slots[1].available,false)
 assert.equal(f.call({},'doctor_availability').result.slots[0].available,false)
})
test('foreign/missing appointments and source revocation remain denied; typed snapshots stay explicitly unsupported',()=>{
 const f=fixture();assert.equal(f.call({p_appointment:id(90)}).status,400);assert.equal(f.call({p_appointment:id(90)}).result.code,'42501')
 assert.equal(f.call({p_type:id(91),p_version:1}).result.code,'22023')
 f.original.consultation_snapshot={id:id(92)};assert.equal(f.call().result.code,'22023');delete f.original.consultation_snapshot
 f.revoke();assert.equal(f.call().result.code,'42501')
})
