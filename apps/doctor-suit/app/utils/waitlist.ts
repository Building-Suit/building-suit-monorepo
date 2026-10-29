import{doctorUuid}from'./locationContext.ts'
import{doctorScheduleDate}from'./availability.ts'
import{consultationType,type ConsultationType}from'./consultations.ts'
export const waitlistStates=['waiting','offered','accepted','expired','cancelled']as const
export type WaitlistStatus=typeof waitlistStates[number]
export type WaitlistAction='create'|'offer'|'accept'|'cancel'|'revoke_contact'|'expire'
export type WaitlistBlocker='contact_permission'|'patient_archived'|'request_window_elapsed'|'clinic_changed'|'type_changed'|null
export interface WaitlistRow{id:string;patientId:string;patientName:string;type:ConsultationType;timezone:string;locationName:string;locationVersion:number;dateFrom:string;dateTo:string;minuteStart:number;minuteEnd:number;contactPermission:boolean;permissionSource:string;permissionRecordedAt:string;state:WaitlistStatus;version:number;offerId:string|null;startsAt:string|null;endsAt:string|null;expiresAt:string|null;appointmentId:string|null;blocker:WaitlistBlocker;canOffer:boolean;canAccept:boolean;canCancel:boolean;canRevokeContact:boolean;canExpire:boolean}
export interface WaitlistQuery{page:number;state:'all'|WaitlistStatus;search:string}
export interface WaitlistDirectory{practiceId:string;locationId:string;timezone:string;locationVersion:number;observedAt:string;page:number;total:number;canManage:boolean;rows:WaitlistRow[]}
export interface WaitlistResult{entryId:string;version:number;state:WaitlistStatus;offerId:string|null;appointmentId:string|null}
export interface WaitlistEvent{id:string;action:WaitlistAction;version:number;offerId:string|null;reason:string|null;actor:string;at:string}
export interface WaitlistHistory{entryId:string;page:number;total:number;events:WaitlistEvent[]}
export type WaitlistCreate={patient_id:string;type_id:string;type_version:number;date_from:string;date_to:string;minute_start:number;minute_end:number;contact_permission:boolean;permission_source:string}
export type WaitlistOffer={date:string;minute:number;schedule_version:number;location_version:number;expires_at:string}
export type WaitlistInput=WaitlistCreate|WaitlistOffer|{reason:string}|Record<string,never>
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const integer=(v:unknown,min=0):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=Number.MAX_SAFE_INTEGER
const text=(v:unknown,max=200,empty=false):v is string=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0)&&!Array.from(v).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)
const stamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const nullableUuid=(v:unknown):v is string|null=>v===null||doctorUuid(v)
const nullableStamp=(v:unknown):v is string|null=>v===null||stamp(v)
const status=(v:unknown):v is WaitlistStatus=>waitlistStates.includes(v as WaitlistStatus)
function zone(v:unknown):v is string{if(typeof v!=='string')return false;try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}}
function invalid():never{throw new Error('DOCTOR_WAITLIST_RESPONSE_INVALID')}
export function validWaitlistQuery(q:WaitlistQuery){return integer(q.page)&&q.page<=100000&&['all',...waitlistStates].includes(q.state)&&typeof q.search==='string'&&q.search.length<=100}
export function validWaitlistInput(action:WaitlistAction,input:unknown):boolean{
 if(!object(input))return false
 if(action==='create'){return Object.keys(input).length===9&&doctorUuid(input.patient_id)&&doctorUuid(input.type_id)&&integer(input.type_version,1)&&doctorScheduleDate(input.date_from)&&doctorScheduleDate(input.date_to)&&input.date_to>=input.date_from&&integer(input.minute_start)&&input.minute_start<1440&&integer(input.minute_end,1)&&input.minute_end<=1440&&input.minute_end>input.minute_start&&typeof input.contact_permission==='boolean'&&text(input.permission_source,200,!input.contact_permission)}
 if(action==='offer')return Object.keys(input).length===5&&doctorScheduleDate(input.date)&&integer(input.minute)&&input.minute<1440&&integer(input.schedule_version,1)&&integer(input.location_version,1)&&stamp(input.expires_at)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(input.expires_at)
 if(action==='expire')return Object.keys(input).length===0
 return['accept','cancel','revoke_contact'].includes(action)&&Object.keys(input).length===1&&text(input.reason)
}
export function waitlistDirectory(value:unknown,practice:string,location:string,query:WaitlistQuery):WaitlistDirectory{
 if(!object(value)||value.practice_id!==practice||value.location_id!==location||value.data_mode!=='synthetic'||value.external_messages!=='disabled'||value.page!==query.page||!integer(value.total)||typeof value.can_manage!=='boolean'||!zone(value.timezone)||!integer(value.location_version,1)||!stamp(value.observed_at)||!Array.isArray(value.rows)||value.rows.length>20)invalid()
 const observed=Date.parse(value.observed_at),canManage=value.can_manage
 const rows:WaitlistRow[]=value.rows.map(v=>{
  if(!object(v)||!doctorUuid(v.id)||!doctorUuid(v.patient_id)||!text(v.patient_name)||!zone(v.timezone)||!text(v.location_name)||!integer(v.captured_location_version,1)||!doctorScheduleDate(v.date_from)||!doctorScheduleDate(v.date_to)||v.date_to<v.date_from||!integer(v.minute_start)||v.minute_start>1439||!integer(v.minute_end,1)||v.minute_end>1440||v.minute_end<=v.minute_start||typeof v.contact_permission!=='boolean'||!text(v.permission_source,200,!v.contact_permission)||!stamp(v.permission_recorded_at)||!status(v.state)||!integer(v.version,1)||!nullableUuid(v.offer_id)||!nullableUuid(v.appointment_id)||!nullableStamp(v.starts_at)||!nullableStamp(v.ends_at)||!nullableStamp(v.expires_at)||![null,'contact_permission','patient_archived','request_window_elapsed','clinic_changed','type_changed'].includes(v.blocked_reason as WaitlistBlocker)||['can_offer','can_accept','can_cancel','can_revoke_contact','can_expire'].some(k=>typeof v[k]!=='boolean'))invalid()
  if((v.offer_id===null)!==(v.starts_at===null)||(v.offer_id===null)!==(v.ends_at===null)||(v.offer_id===null)!==(v.expires_at===null)||v.starts_at&&v.ends_at&&Date.parse(v.ends_at)<=Date.parse(v.starts_at)||v.state==='accepted'&&!v.appointment_id||['offered','expired','accepted'].includes(v.state)&&!v.offer_id)invalid()
  const flags=['can_offer','can_accept','can_cancel','can_revoke_contact','can_expire'];if(!canManage&&flags.some(k=>v[k]))invalid()
  if(v.can_offer&&(v.state!=='waiting'||!v.contact_permission||v.blocked_reason!==null)||v.can_accept&&(v.state!=='offered'||!v.contact_permission||v.blocked_reason!==null||!v.expires_at||Date.parse(v.expires_at)<=observed)||v.can_cancel&&!['waiting','offered'].includes(v.state)||v.can_revoke_contact&&!v.contact_permission||v.can_expire&&(v.state!=='expired'||!v.expires_at||Date.parse(v.expires_at)>observed))invalid()
  const type=consultationType(v.requested_type,practice);if(!type.location_ids.includes(location))invalid()
  return{id:v.id,patientId:v.patient_id,patientName:v.patient_name,type,timezone:v.timezone,locationName:v.location_name,locationVersion:v.captured_location_version,dateFrom:v.date_from,dateTo:v.date_to,minuteStart:v.minute_start,minuteEnd:v.minute_end,contactPermission:v.contact_permission,permissionSource:v.permission_source,permissionRecordedAt:v.permission_recorded_at,state:v.state,version:v.version,offerId:v.offer_id,startsAt:v.starts_at,endsAt:v.ends_at,expiresAt:v.expires_at,appointmentId:v.appointment_id,blocker:v.blocked_reason as WaitlistBlocker,canOffer:v.can_offer as boolean,canAccept:v.can_accept as boolean,canCancel:v.can_cancel as boolean,canRevokeContact:v.can_revoke_contact as boolean,canExpire:v.can_expire as boolean}
 })
 if(new Set(rows.map(v=>v.id)).size!==rows.length||rows.length>value.total||rows.some(v=>query.state!=='all'&&v.state!==query.state))invalid()
 return{practiceId:practice,locationId:location,timezone:value.timezone,locationVersion:value.location_version,observedAt:value.observed_at,page:query.page,total:value.total,canManage,rows}
}
export function waitlistResult(v:unknown):WaitlistResult{if(!object(v)||!doctorUuid(v.entry_id)||!integer(v.version,1)||!status(v.state)||!nullableUuid(v.offer_id)||!nullableUuid(v.appointment_id)||v.external_messages!=='disabled'||v.state==='accepted'&&!v.appointment_id)invalid();return{entryId:v.entry_id,version:v.version,state:v.state,offerId:v.offer_id,appointmentId:v.appointment_id}}
export function waitlistHistory(v:unknown,practice:string,location:string,entry:string,page:number):WaitlistHistory{
 if(!object(v)||v.practice_id!==practice||v.location_id!==location||v.entry_id!==entry||v.page!==page||!integer(v.total)||!Array.isArray(v.events)||v.events.length>20)invalid()
 const events:WaitlistEvent[]=v.events.map(e=>{if(!object(e)||!(typeof e.id==='string'&&/^[1-9]\d*$/.test(e.id)||integer(e.id,1))||e.practice_id!==practice||e.location_id!==location||e.entry_id!==entry||!['waitlist.create','waitlist.offer','waitlist.accept','waitlist.cancel','waitlist.revoke_contact','waitlist.expire'].includes(String(e.action))||!integer(e.record_version,1)||!nullableUuid(e.offer_id)||!(e.reason===null||text(e.reason))||!doctorUuid(e.actor_user_id)||!stamp(e.happened_at))invalid();return{id:String(e.id),action:String(e.action).slice('waitlist.'.length)as WaitlistAction,version:e.record_version,offerId:e.offer_id,reason:e.reason,actor:e.actor_user_id,at:e.happened_at}})
 if(new Set(events.map(e=>e.id)).size!==events.length||events.length>v.total)invalid();return{entryId:entry,page,total:v.total,events}
}
