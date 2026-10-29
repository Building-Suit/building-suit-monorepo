import{doctorUuid}from'./locationContext.ts'
import{doctorScheduleDate}from'./availability.ts'
export const worklistKinds=['appointment_follow_up','contact_preference_review','document_receipt_check','general_administration']as const
export const worklistStates=['assigned','in_progress','completed','cancelled']as const
export const worklistReasons=['workload','absence','correction']as const
export type WorklistKind=typeof worklistKinds[number]
export type WorklistStatus=typeof worklistStates[number]
export type WorklistAction='create'|'start'|'complete'|'reassign'|'cancel'
export interface WorklistQuery{page:number;state:'all'|WorklistStatus;mine:boolean;overdue:boolean}
export interface WorklistRow{id:string;kind:WorklistKind;patientId:string|null;patientName:string|null;assignee:string;dueAt:string;timezone:string;locationName:string;locationVersion:number;state:WorklistStatus;version:number;overdue:boolean;blocked:boolean;canStart:boolean;canComplete:boolean;canReassign:boolean;canCancel:boolean}
export interface WorklistDirectory{practiceId:string;locationId:string;page:number;total:number;canManage:boolean;canReadPatients:boolean;timezone:string;locationVersion:number;observedAt:string;rows:WorklistRow[]}
export interface WorklistAssignee{userId:string;label:string|null;canReadPatients:boolean}
export interface WorklistEvent{id:string;actor:string;action:WorklistAction;version:number;previousAssignee:string|null;assignee:string;previousState:WorklistStatus|null;state:WorklistStatus;reason:string;at:string}
export interface WorklistHistory{taskId:string;page:number;total:number;events:WorklistEvent[]}
export type WorklistInput={kind:WorklistKind;patient_id:string|null;assignee_user_id:string;due_day:string;due_minute:number;location_version:number}|{assignee_user_id:string;reason:typeof worklistReasons[number]}|{reason:'no_longer_needed'}|Record<string,never>
export const worklistObject=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const integer=(v:unknown,min=0):v is number=>Number.isSafeInteger(v)&&Number(v)>=min
const stamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=200&&!Array.from(v).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)
const nullableUuid=(v:unknown):v is string|null=>v===null||doctorUuid(v)
const state=(v:unknown):v is WorklistStatus=>worklistStates.includes(v as WorklistStatus)
function zone(v:unknown):v is string{if(typeof v!=='string')return false;try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}}
function invalid():never{throw new Error('DOCTOR_WORKLIST_RESPONSE_INVALID')}
export function validWorklistQuery(q:WorklistQuery){return integer(q.page)&&q.page<=100000&&['all',...worklistStates].includes(q.state)&&typeof q.mine==='boolean'&&typeof q.overdue==='boolean'}
export function validWorklistInput(action:WorklistAction,v:unknown):v is WorklistInput{
 if(!worklistObject(v))return false
 if(action==='create')return Object.keys(v).length===6&&worklistKinds.includes(v.kind as WorklistKind)&&nullableUuid(v.patient_id)&&doctorUuid(v.assignee_user_id)&&doctorScheduleDate(v.due_day)&&integer(v.due_minute)&&v.due_minute<1440&&integer(v.location_version,1)
 if(action==='reassign')return Object.keys(v).length===2&&doctorUuid(v.assignee_user_id)&&worklistReasons.includes(v.reason as typeof worklistReasons[number])
 if(action==='cancel')return Object.keys(v).length===1&&v.reason==='no_longer_needed'
 return['start','complete'].includes(action)&&Object.keys(v).length===0
}
export function worklistDirectory(v:unknown,practice:string,location:string,q:WorklistQuery):WorklistDirectory{
 if(!worklistObject(v)||v.practice_id!==practice||v.location_id!==location||v.page!==q.page||!integer(v.total)||typeof v.can_manage!=='boolean'||typeof v.can_read_patients!=='boolean'||!zone(v.timezone)||!integer(v.location_version,1)||!stamp(v.observed_at)||v.data_mode!=='synthetic'||v.external_messages!=='disabled'||!Array.isArray(v.rows)||v.rows.length>20)invalid()
 const patientAccess=v.can_read_patients,manager=v.can_manage,observed=Date.parse(v.observed_at)
 const rows=v.rows.map((r):WorklistRow=>{
  if(!worklistObject(r)||!doctorUuid(r.id)||!worklistKinds.includes(r.kind as WorklistKind)||!nullableUuid(r.patient_id)||!(r.patient_name===null||text(r.patient_name))||(r.patient_id===null)!==(r.patient_name===null)||!doctorUuid(r.assignee_user_id)||!stamp(r.due_at)||!zone(r.timezone)||!text(r.location_name)||!integer(r.captured_location_version,1)||!state(r.state)||!integer(r.version,1)||['overdue','blocked','can_start','can_complete','can_reassign','can_cancel'].some(k=>typeof r[k]!=='boolean'))invalid()
  if(!patientAccess&&(r.patient_id!==null||r.patient_name!==null)||!manager&&(r.can_reassign||r.can_cancel)||r.blocked&&(r.can_start||r.can_complete)||!['assigned','in_progress'].includes(r.state)&&(r.can_start||r.can_complete||r.can_reassign||r.can_cancel)||r.can_start&&r.state!=='assigned'||r.overdue!==(['assigned','in_progress'].includes(r.state)&&Date.parse(r.due_at)<observed)||q.state!=='all'&&r.state!==q.state||q.overdue&&!r.overdue)invalid()
  return{id:r.id,kind:r.kind as WorklistKind,patientId:r.patient_id,patientName:r.patient_name,assignee:r.assignee_user_id,dueAt:r.due_at,timezone:r.timezone,locationName:r.location_name,locationVersion:r.captured_location_version,state:r.state,version:r.version,overdue:r.overdue as boolean,blocked:r.blocked as boolean,canStart:r.can_start as boolean,canComplete:r.can_complete as boolean,canReassign:r.can_reassign as boolean,canCancel:r.can_cancel as boolean}
 });if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.length>v.total)invalid()
 return{practiceId:practice,locationId:location,page:q.page,total:v.total,canManage:manager,canReadPatients:patientAccess,timezone:v.timezone,locationVersion:v.location_version,observedAt:v.observed_at,rows}
}
export function worklistOptions(v:unknown,practice:string,location:string):WorklistAssignee[]{if(!worklistObject(v)||v.practice_id!==practice||v.location_id!==location||!Array.isArray(v.assignees))invalid();const rows=v.assignees.map((r):WorklistAssignee=>{if(!worklistObject(r)||!doctorUuid(r.user_id)||!(r.label===null||text(r.label))||typeof r.can_read_patients!=='boolean')invalid();return{userId:r.user_id,label:r.label,canReadPatients:r.can_read_patients}});if(new Set(rows.map(r=>r.userId)).size!==rows.length)invalid();return rows}
export function worklistResult(v:unknown,id:string,version:number){if(!worklistObject(v)||v.task_id!==id||v.version!==version+1||!state(v.state)||v.external_messages!=='disabled')invalid();return{taskId:id,version:version+1,state:v.state}}
export function worklistHistory(v:unknown,practice:string,location:string,id:string,page:number):WorklistHistory{
 if(!worklistObject(v)||v.practice_id!==practice||v.location_id!==location||v.task_id!==id||v.page!==page||!integer(v.total)||!Array.isArray(v.events)||v.events.length>20)invalid()
 const events=v.events.map((e):WorklistEvent=>{if(!worklistObject(e)||typeof e.id!=='string'||!/^[1-9]\d*$/.test(e.id)||e.practice_id!==practice||e.location_id!==location||e.task_id!==id||!doctorUuid(e.actor_user_id)||!['create','start','complete','reassign','cancel'].includes(String(e.action))||!integer(e.record_version,1)||!nullableUuid(e.previous_assignee)||!doctorUuid(e.next_assignee)||!(e.previous_state===null||state(e.previous_state))||!state(e.state)||!['created','started','completed',...worklistReasons,'no_longer_needed'].includes(String(e.reason))||!stamp(e.happened_at))invalid();return{id:e.id,actor:e.actor_user_id,action:e.action as WorklistAction,version:e.record_version,previousAssignee:e.previous_assignee,assignee:e.next_assignee,previousState:e.previous_state,state:e.state,reason:e.reason as string,at:e.happened_at}})
 if(new Set(events.map(e=>e.id)).size!==events.length||events.length>v.total)invalid();return{taskId:id,page,total:v.total,events}
}
