import { doctorAdministrativeReason } from '../../app/utils/administrativeEdition.ts'
// Owned HTTP browser protocol. Actual state/lock/RLS and Realtime have separate obligations.
import { randomUUID } from 'node:crypto'
import { instant,availabilityProtocol } from './availability-provider.mjs'
import { doctorAvailabilityToday } from '../../app/utils/availability.ts'
import { doctorAppointmentTransitions } from '../../app/utils/appointments.ts'
export function seedAppointmentProtocol(data) {
  if(data.appointmentRows)return
  data.appointmentRows = [];data.appointmentHistory = {};data.appointmentCommands = {};data.appointmentRevisions = {}
  for(const membership of data.memberships)for(const grant of membership.grants)grant.capabilities = [...new Set([...grant.capabilities,'appointments.read',...(grant.location_id===data.locations[0].id ? ['appointments.write','queue.manage','patients.read'] : [])])]
  data.locations.forEach((location,index) => {
    if(index===0)data.scheduleRules[location.id] = { slot_minutes: 20,weekly: Array.from({ length: 7 },(_,weekday) => ({ weekday,start: 540,end: 1020 })),exceptions: [],version: 1 }
    const practice = data.practices.find(item => item.id===location.practice_id);const patients = data.patientRows.filter(item => item.practice_id===practice.id)
    for(let n=0;n<(index===0 ? 2 : 1);n++) {
      const day = doctorAvailabilityToday(location.timezone);const stamp = instant(day,540+n*60,location.timezone)
      const item = { id: randomUUID(),practice_id: practice.id,doctor_user_id: practice.owner_user_id,location_id: location.id,patient_id: patients[n].id,starts_at: stamp,ends_at: new Date(Date.parse(stamp)+20*60000).toISOString(),timezone: location.timezone,location_name: location.name,state: 'booked',version: 1,checked_in_at: null,started_at: null,completed_at: null }
      data.appointmentRows.push(item);data.scheduleCommitments.push(item);data.appointmentRevisions[location.id] = 1
      data.appointmentHistory[item.id] = [{ id: String(data.appointmentRows.length),type: 'appointment.booked',version: 1,at: new Date().toISOString(),actor_user_id: practice.owner_user_id,location_id: location.id,details: { starts_at: item.starts_at,ends_at: item.ends_at,timezone: item.timezone,location_name: item.location_name } }]
    }
  })
}
export function appointmentProtocol({ candidate = false,data,actor,sessionId,rpc,input,send,capability }) {
  if(!['doctor_appointment_board','doctor_appointment_history','doctor_book_appointment','doctor_reschedule_appointment','doctor_transition_appointment'].includes(rpc))return false
  const reject = (code='42501',message='DOCTOR_ACCESS_DENIED') => { send({ code,message },400);return true }
  const location = data.locations.find(item => item.id===input.p_location && item.practice_id===input.p_practice && !item.archived_at)
  const can = (permission,place=location) => place && capability(place.practice_id,place.id,permission)
  if(!location || !can('appointments.read'))return reject()
  const scoped = data.appointmentRows.filter(item => item.practice_id===input.p_practice && item.location_id===location.id)
  const projection = item => ({ ...item,patient_name: can('patients.read') ? data.patientRows.find(patient => patient.id===item.patient_id)?.name || null : null })
  if(rpc==='doctor_appointment_board') {
    const items = scoped.filter(item => doctorAvailabilityToday(location.timezone,new Date(item.starts_at))===input.p_day).sort((a,b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));const queue = scoped.filter(item => ['checked_in','in_progress'].includes(item.state)).sort((a,b) => a.checked_in_at.localeCompare(b.checked_in_at) || a.id.localeCompare(b.id));const page = input.p_page || 0;const queuePage = input.p_queue_page || 0
    send({ practice_id: input.p_practice,location_id: location.id,date: input.p_day,timezone: location.timezone,location_version: location.version,items: items.slice(page*20,page*20+20).map(projection),page,total: items.length,queue: queue.slice(queuePage*20,queuePage*20+20).map(projection),queue_page: queuePage,queue_total: queue.length,revision: data.appointmentRevisions[location.id] || 0,can_write: Boolean(can('appointments.write')),can_queue: Boolean(can('queue.manage')),can_read_patients: Boolean(can('patients.read')),external_notifications: 'disabled' });return true
  }
  let item = scoped.find(item => item.id===input.p_appointment)
  if(rpc==='doctor_appointment_history') {
    if(!item)return reject();const events = data.appointmentHistory[item.id];if(events.some(event => !capability(input.p_practice,event.location_id,'appointments.read')))return reject();const page = input.p_page || 0
    send({ practice_id: input.p_practice,location_id: location.id,appointment_id: item.id,version: item.version,page,total: events.length,events: [...events].reverse().slice(page*20,page*20+20) });return true
  }
  const destination = rpc==='doctor_reschedule_appointment' ? data.locations.find(place => place.id===input.p_destination && place.practice_id===input.p_practice && !place.archived_at) : location
  if(rpc==='doctor_transition_appointment') {
    if(!item)return reject()
    if(!can(['cancelled','no_show'].includes(input.p_state) ? 'appointments.write' : 'queue.manage'))return reject()
    if(item.state==='checked_in' && input.p_state==='cancelled' && !can('queue.manage'))return reject()
  } else if(!destination || !can('appointments.write') || !can('patients.read') || !can('appointments.read',destination) || !can('appointments.write',destination) || !can('patients.read',destination))return reject()
  if(candidate && (rpc==='doctor_reschedule_appointment' || (rpc==='doctor_transition_appointment' && ['cancelled','no_show'].includes(input.p_state))) && !doctorAdministrativeReason(input.p_reason))return reject('22023','DOCTOR_APPOINTMENT_REASON_REQUIRED')
  const key = `${actor.id}:${input.p_key}`;const fingerprint = JSON.stringify([sessionId,rpc,input]);const receipt = data.appointmentCommands[key]
  if(receipt) { if(receipt.fingerprint!==fingerprint)return reject('22023','DOCTOR_IDEMPOTENCY_CONFLICT');send(receipt.result);return true }
  if(rpc!=='doctor_book_appointment' && (!item || item.version!==input.p_expected_version))return reject('40001','DOCTOR_APPOINTMENT_CONFLICT')
  let details;let event;let oldLocation = location.id
  if(rpc==='doctor_transition_appointment') {
    if(!doctorAppointmentTransitions(item.state).includes(input.p_state))return reject('22023','DOCTOR_APPOINTMENT_TRANSITION_DENIED')
    if(['cancelled','no_show'].includes(input.p_state) && !input.p_reason?.trim())return reject('22023','DOCTOR_APPOINTMENT_REASON_REQUIRED')
    if(input.p_state==='checked_in' && doctorAvailabilityToday(item.timezone,new Date(item.starts_at))!==doctorAvailabilityToday(item.timezone))return reject('22023','DOCTOR_APPOINTMENT_CHECKIN_DAY')
    if(input.p_state==='in_progress' && data.appointmentRows.some(other => other.doctor_user_id===item.doctor_user_id && other.state==='in_progress'))return reject('40001','DOCTOR_QUEUE_ALREADY_IN_PROGRESS')
    details = { from: item.state,to: input.p_state,reason: input.p_reason || null };item.state = input.p_state;item.version++;if(item.state==='checked_in')item.checked_in_at = new Date().toISOString();if(item.state==='in_progress')item.started_at = new Date().toISOString();if(item.state==='completed')item.completed_at = new Date().toISOString();event = `appointment.${item.state}`
  } else {
    if(item && item.state!=='booked')return reject('22023','DOCTOR_APPOINTMENT_TRANSITION_DENIED')
    const patient = data.patientRows.find(patient => patient.id===(item?.patient_id || input.p_patient) && patient.practice_id===input.p_practice && !patient.archived_at);if(!patient)return reject()
    let slots;availabilityProtocol({ data,actor,rpc: 'doctor_availability',input: { p_practice: input.p_practice,p_location: destination.id,p_day: input.p_day },send: value => { slots = value },capability })
    if(slots?.schedule_version!==input.p_schedule_version || destination.version!==input.p_location_version)return reject('40001','DOCTOR_AVAILABILITY_CONFLICT')
    const slot = slots.slots?.find(slot => slot.minute===input.p_minute && slot.available);if(!slot)return reject('40001','DOCTOR_APPOINTMENT_CONFLICT')
    const practice = data.practices.find(practice => practice.id===input.p_practice)
    const snapshot = row => ({ location_id: row.location_id,location_name: row.location_name,timezone: row.timezone,starts_at: row.starts_at,ends_at: row.ends_at })
    const target = { location_id: destination.id,location_name: destination.name,timezone: destination.timezone,starts_at: slot.starts_at,ends_at: slot.ends_at }
    if(item) { details = { reason: input.p_reason,from: snapshot(item),to: target };Object.assign(item,target,{ version: item.version+1 });event = 'appointment.rescheduled' }
    else { item = { id: randomUUID(),practice_id: practice.id,doctor_user_id: practice.owner_user_id,patient_id: patient.id,...target,state: 'booked',version: 1,checked_in_at: null,started_at: null,completed_at: null };data.appointmentRows.push(item);data.scheduleCommitments.push(item);data.appointmentHistory[item.id] = [];details = target;event = 'appointment.booked' }
  }
  data.appointmentHistory[item.id].push({ id: String(Object.values(data.appointmentHistory).flat().length+1),type: event,version: item.version,at: new Date().toISOString(),actor_user_id: actor.id,location_id: item.location_id,details })
  data.appointmentRevisions[oldLocation] = (data.appointmentRevisions[oldLocation] || 0)+1;if(oldLocation!==item.location_id)data.appointmentRevisions[item.location_id] = (data.appointmentRevisions[item.location_id] || 0)+1
  const result = { appointment_id: item.id,version: item.version,state: item.state };data.appointmentCommands[key] = { fingerprint,result };send(result);return true
}


export function seedDashboardProtocol(data) {
  if(data.dashboardSeeded)return
  data.dashboardSeeded = true
  for(const membership of data.memberships)for(const grant of membership.grants)grant.capabilities = [...new Set([...grant.capabilities,'dashboard.read'])]
  // This explicitly enabled browser fixture is larger than either source page.
  const location = data.locations[0];const original = data.appointmentRows.find(item => item.location_id===location.id)
  const day = doctorAvailabilityToday(location.timezone)
  for(let n=0;n<24;n++) {
    const starts = instant(day,n*20,location.timezone)
    const item = { ...original,id: randomUUID(),starts_at: starts,ends_at: new Date(Date.parse(starts)+20*60000).toISOString(),state: n<22 ? 'checked_in' : 'booked',checked_in_at: n<22 ? new Date(Date.now()+n*1000).toISOString() : null }
    data.appointmentRows.push(item);data.scheduleCommitments.push(item)
    data.appointmentHistory[item.id] = [{ id: String(1000+n),type: 'appointment.booked',version: 1,at: new Date().toISOString(),actor_user_id: item.doctor_user_id,location_id: location.id,details: {} }]
  }
}
