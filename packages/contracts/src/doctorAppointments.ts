import { doctorAvailabilityToday,doctorScheduleDate } from './doctorAvailability.ts'
import {consultationType,type ConsultationType}from './doctorConsultations.ts'
const doctorUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const doctorAppointmentStates = ['booked','checked_in','in_progress','completed','cancelled','no_show'] as const
export type DoctorAppointmentState = typeof doctorAppointmentStates[number]
export interface DoctorAppointment { id: string;consultation?:ConsultationType|null; practiceId: string; locationId: string; patientId: string; patientName: string | null; startsAt: string; endsAt: string; timezone: string; locationName: string; state: DoctorAppointmentState; version: number; checkedInAt: string | null; startedAt: string | null; completedAt: string | null }
export interface DoctorAppointmentBoard { practiceId: string; locationId: string; date: string; timezone: string; locationVersion: number; items: DoctorAppointment[]; queue: DoctorAppointment[]; page: number; total: number; queuePage: number; queueTotal: number; revision: number; canWrite: boolean; canQueue: boolean; canReadPatients: boolean; externalNotifications: 'disabled' }
export interface DoctorAppointmentSnapshot { locationId: string; locationName: string; timezone: string; startsAt: string; endsAt: string }
export interface DoctorAppointmentEvent { id: string; type: string; version: number; at: string; actorUserId: string; locationId: string; reason: string | null; from: DoctorAppointmentSnapshot | null; to: DoctorAppointmentSnapshot | null; previousState: DoctorAppointmentState | null; nextState: DoctorAppointmentState | null }
export interface DoctorAppointmentHistory { appointmentId: string; version: number; page: number; total: number; events: DoctorAppointmentEvent[] }
export interface DoctorAppointmentQuery { date: string; page: number; queuePage: number }
export interface DoctorOfferSelection {typeId?:string;typeVersion?:number;appointmentId?:string}
export const doctorReceptionActions=['late_check_in','reverse_no_show','queue_exit','move_to_end'] as const
export type DoctorReceptionAction=typeof doctorReceptionActions[number]
export type DoctorAppointmentCommand =
  | { kind:'reception';appointmentId:string;version:number;action:DoctorReceptionAction;reason:string }
  | { kind:'walk_in';typeId?:string;typeVersion?:number;patientId:string;destinationId:string;date:string;minute:number;scheduleVersion:number;locationVersion:number;reason:string }
  | { kind: 'book'; typeId?:string;typeVersion?:number;patientId: string; destinationId: string; date: string; minute: number; scheduleVersion: number; locationVersion: number }
  | { kind: 'reschedule'; appointmentId: string; version: number; destinationId: string; date: string; minute: number; scheduleVersion: number; locationVersion: number; reason: string }
  | { kind: 'transition'; appointmentId: string; version: number; state: Exclude<DoctorAppointmentState,'booked'>; reason: string }
const object = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const count = (value: unknown,min = 0): value is number => Number.isSafeInteger(value) && Number(value)>=min && Number(value)<=Number.MAX_SAFE_INTEGER
const timestamp = (value: unknown): value is string => typeof value==='string' && Number.isFinite(Date.parse(value))
const nullableTime = (value: unknown): value is string | null => value===null || timestamp(value)
const text = (value: unknown,max = 200): value is string => typeof value==='string' && Boolean(value.trim()) && value.length<=max && !Array.from(value).some(char => char.charCodeAt(0)<32 || char.charCodeAt(0)===127)
function invalid(): never { throw new Error('DOCTOR_APPOINTMENT_RESPONSE_INVALID') }
function zone(value: unknown): value is string { if(typeof value!=='string')return false;try { new Intl.DateTimeFormat('en',{ timeZone: value }); return true } catch { return false } }
export const doctorAppointmentState = (value: unknown): value is DoctorAppointmentState => doctorAppointmentStates.includes(value as DoctorAppointmentState)
export const doctorAppointmentReason = (value: string) => text(value.trim())
export function doctorAppointmentTransitions(state: DoctorAppointmentState): Exclude<DoctorAppointmentState,'booked'>[] {
  return state==='booked' ? ['checked_in','cancelled','no_show'] : state==='checked_in' ? ['in_progress','cancelled'] : state==='in_progress' ? ['completed'] : []
}
export function validDoctorAppointmentCommand(value: DoctorAppointmentCommand) {
  if(!['book','reschedule','transition','reception','walk_in'].includes(value.kind))return false
  if(value.kind==='reception')return doctorUuid(value.appointmentId)&&count(value.version,1)&&doctorReceptionActions.includes(value.action)&&doctorAppointmentReason(value.reason)
  if(value.kind==='transition')return doctorUuid(value.appointmentId) && count(value.version,1) && ['checked_in','in_progress','completed','cancelled','no_show'].includes(value.state) && (['cancelled','no_show'].includes(value.state) ? doctorAppointmentReason(value.reason) : value.reason==='')
  return doctorUuid(value.destinationId) && doctorScheduleDate(value.date) && count(value.minute) && value.minute<1440 && count(value.scheduleVersion,1) && count(value.locationVersion,1)
    && (value.kind==='book'||value.kind==='walk_in' ? (value.kind!=='walk_in'||doctorAppointmentReason(value.reason))&&doctorUuid(value.patientId) && (value.typeId===undefined&&value.typeVersion===undefined || doctorUuid(value.typeId)&&count(value.typeVersion,1)) : doctorUuid(value.appointmentId) && count(value.version,1) && doctorAppointmentReason(value.reason))
}
export function doctorAppointment(value: unknown,practiceId: string,locationId: string): DoctorAppointment {
  if(!object(value) || !doctorUuid(value.id) || value.practice_id!==practiceId || value.location_id!==locationId || !doctorUuid(value.patient_id)
    || !(value.patient_name===null || text(value.patient_name)) || !timestamp(value.starts_at) || !timestamp(value.ends_at) || Date.parse(value.ends_at)<=Date.parse(value.starts_at) || Date.parse(value.ends_at)-Date.parse(value.starts_at)>7200000
    || !zone(value.timezone) || !text(value.location_name,120) || !doctorAppointmentState(value.state) || !count(value.version,1)
    || !nullableTime(value.checked_in_at) || !nullableTime(value.started_at) || !nullableTime(value.completed_at)
    || (['checked_in','in_progress','completed'].includes(value.state) && !value.checked_in_at) || (['in_progress','completed'].includes(value.state) && !value.started_at) || (value.state==='completed' && !value.completed_at))invalid()
  return { id: value.id,consultation:value.consultation_snapshot==null?null:consultationType(value.consultation_snapshot,practiceId),practiceId,locationId,patientId: value.patient_id,patientName: value.patient_name,startsAt: value.starts_at,endsAt: value.ends_at,timezone: value.timezone,locationName: value.location_name,state: value.state,version: value.version,checkedInAt: value.checked_in_at,startedAt: value.started_at,completedAt: value.completed_at }
}
export function doctorAppointmentBoard(value: unknown,practiceId: string,locationId: string,query: DoctorAppointmentQuery): DoctorAppointmentBoard {
  if(!object(value) || value.practice_id!==practiceId || value.location_id!==locationId || value.date!==query.date || value.page!==query.page || value.queue_page!==query.queuePage
    || !zone(value.timezone) || !count(value.location_version,1) || !count(value.revision) || !count(value.total) || !count(value.queue_total)
    || !Array.isArray(value.items) || value.items.length>20 || !Array.isArray(value.queue) || value.queue.length>20 || value.items.length>value.total || value.queue.length>value.queue_total
    || typeof value.can_write!=='boolean' || typeof value.can_queue!=='boolean' || typeof value.can_read_patients!=='boolean' || value.external_notifications!=='disabled')invalid()
  const items = value.items.map(item => doctorAppointment(item,practiceId,locationId)); const queue = value.queue.map(item => doctorAppointment(item,practiceId,locationId))
  if(new Set(items.map(item => item.id)).size!==items.length || new Set(queue.map(item => item.id)).size!==queue.length || queue.some(item => !['checked_in','in_progress'].includes(item.state))
    || (!value.can_read_patients && [...items,...queue].some(item => item.patientName!==null)))invalid()
  return { practiceId,locationId,date: query.date,timezone: value.timezone,locationVersion: value.location_version,items,queue,page: query.page,total: value.total,queuePage: query.queuePage,queueTotal: value.queue_total,revision: value.revision,canWrite: value.can_write,canQueue: value.can_queue,canReadPatients: value.can_read_patients,externalNotifications: 'disabled' }
}
function snapshot(value: unknown): DoctorAppointmentSnapshot {
  if(!object(value) || !doctorUuid(value.location_id) || !text(value.location_name,120) || !zone(value.timezone) || !timestamp(value.starts_at) || !timestamp(value.ends_at) || Date.parse(value.starts_at)>=Date.parse(value.ends_at))invalid()
  return { locationId: value.location_id,locationName: value.location_name,timezone: value.timezone,startsAt: value.starts_at,endsAt: value.ends_at }
}
export function doctorAppointmentHistory(value: unknown,practiceId: string,locationId: string,appointmentId: string,page: number): DoctorAppointmentHistory {
  if(!object(value) || value.practice_id!==practiceId || value.location_id!==locationId || value.appointment_id!==appointmentId || !count(value.version,1) || value.page!==page || !count(value.total) || !Array.isArray(value.events) || value.events.length>20 || value.events.length>value.total)invalid()
  const events = value.events.map(item => {
    if(!object(item) || typeof item.id!=='string' || !/^[1-9]\d*$/.test(item.id) || !['appointment.booked','appointment.rescheduled',...doctorAppointmentStates.map(state => `appointment.${state}`),...doctorReceptionActions.map(action=>`appointment.reception.${action}`),'appointment.reception.walk_in'].includes(String(item.type)) || !count(item.version,1) || !timestamp(item.at) || !doctorUuid(item.actor_user_id) || !doctorUuid(item.location_id) || !object(item.details))invalid()
    const details = item.details; const move = item.type==='appointment.rescheduled'; const transition = !['appointment.booked','appointment.rescheduled'].includes(String(item.type))
    if((details.reason!==null && details.reason!==undefined && !text(details.reason)) || (transition && (!doctorAppointmentState(details.from) || !doctorAppointmentState(details.to))))invalid()
    return { id: item.id,type: String(item.type),version: item.version,at: item.at,actorUserId: item.actor_user_id,locationId: item.location_id,reason: typeof details.reason==='string' ? details.reason : null,from: move ? snapshot(details.from) : null,to: move ? snapshot(details.to) : null,previousState: transition ? details.from as DoctorAppointmentState : null,nextState: transition ? details.to as DoctorAppointmentState : null }
  })
  if(new Set(events.map(item => item.id)).size!==events.length)invalid()
  return { appointmentId,version: value.version,page,total: value.total,events }
}
export function doctorAppointmentResult(value: unknown) { if(!object(value) || !doctorUuid(value.appointment_id) || !count(value.version,1) || (value.state!==undefined && !doctorAppointmentState(value.state)))invalid(); return { appointmentId: value.appointment_id,version: value.version } }

export function doctorReceptionTransitions(item:DoctorAppointment,now=new Date()):DoctorReceptionAction[]{
 if(item.state==='no_show')return['reverse_no_show']
 if(item.state==='checked_in')return['queue_exit','move_to_end']
 if(item.state==='booked'&&Date.parse(item.startsAt)<=now.getTime()&&doctorAvailabilityToday(item.timezone,new Date(item.startsAt))===doctorAvailabilityToday(item.timezone,now))return['late_check_in']
 return[]
}
