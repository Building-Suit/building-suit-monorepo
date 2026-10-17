// Owned browser protocol only. Real IANA/conflict/locking authority is checked in SQL.
import { randomUUID } from 'node:crypto'
import { validDoctorSchedule,doctorAvailabilityToday } from '../../app/utils/availability.ts'
function instant(day,minute,zone) {
  const wall = Date.parse(`${day}T00:00:00Z`)+minute*60000; let value = wall
  for (let attempt=0;attempt<4;attempt++) {
    const parts = new Intl.DateTimeFormat('en',{ timeZone: zone,year: 'numeric',month: '2-digit',day: '2-digit',hour: '2-digit',minute: '2-digit',hourCycle: 'h23' }).formatToParts(new Date(value))
    const number = type => Number(parts.find(item => item.type===type).value)
    const represented = Date.UTC(number('year'),number('month')-1,number('day'),number('hour'),number('minute')); const delta = wall-represented
    if (!delta) return new Date(value).toISOString(); value+=delta
  }
  throw new Error('Synthetic normal-clock fixture conversion failed')
}
export function seedAvailabilityProtocol(data) {
  if (data.scheduleRules) return
  data.scheduleRules = {}; data.scheduleCommands = {}; data.scheduleEvents = []
  const future = new Date(`${doctorAvailabilityToday('Africa/Cairo')}T00:00:00Z`); future.setUTCDate(future.getUTCDate()+7); data.scheduleTestDay = future.toISOString().slice(0,10)
  for (const membership of data.memberships) for (const grant of membership.grants) {
    const place = data.locations.find(item => item.id===grant.location_id)
    grant.capabilities.push('appointments.read',...(place.name==='Clinic A1' ? ['availability.manage','appointments.write'] : []))
    grant.capabilities = [...new Set(grant.capabilities)]
  }
  data.locations.forEach((place,index) => {
    if (index===0) return
    data.scheduleRules[place.id] = { slot_minutes: index===1 ? 40 : 20,weekly: Array.from({ length: 7 },(_,weekday) => ({ weekday,start: 540,end: 1020 })),exceptions: [],version: 1 }
  })
  const location = data.locations[0]; const practice = data.practices[0]
  data.scheduleCommitments = [{ id: randomUUID(),practice_id: practice.id,doctor_user_id: practice.owner_user_id,location_id: location.id,starts_at: instant(data.scheduleTestDay,780,location.timezone),ends_at: instant(data.scheduleTestDay,800,location.timezone),state: 'booked',version: 1 }]
}
export function availabilityProtocol({ data,actor,rpc,input,send,capability }) {
  if (!['doctor_schedule','doctor_write_schedule','doctor_availability'].includes(rpc)) return false
  const reject = (code='42501',message='DOCTOR_ACCESS_DENIED') => { send({ code,message },400); return true }
  const location = data.locations.find(item => item.id===input.p_location && item.practice_id===input.p_practice && !item.archived_at)
  const canManage = location && capability(input.p_practice,location.id,'availability.manage')
  if (!location || (!canManage && !capability(input.p_practice,location.id,'appointments.read'))) return reject()
  const configuration = () => ({ practice_id: input.p_practice,location_id: location.id,timezone: location.timezone,location_version: location.version,...(data.scheduleRules[location.id] || { slot_minutes: 20,weekly: [],exceptions: [],version: 0 }),can_manage: Boolean(canManage),override_policy: 'deny',existing_commitments: data.scheduleCommitments.filter(item => item.practice_id===input.p_practice && item.location_id===location.id).length })
  if (rpc==='doctor_schedule') { send(configuration()); return true }
  if (rpc==='doctor_write_schedule') {
    if (!canManage) return reject()
    if (input.p_location_version!==location.version) return reject('40001','DOCTOR_AVAILABILITY_CONFLICT')
    const raw = input.p_input; const form = raw && { slotMinutes: raw.slot_minutes,weekly: raw.weekly,exceptions: raw.exceptions }
    if (!raw || Object.keys(raw).some(key => !['slot_minutes','weekly','exceptions'].includes(key)) || !validDoctorSchedule(form)) return reject('22023','DOCTOR_AVAILABILITY_INVALID')
    const key = `${actor.id}:${input.p_key}`; const fingerprint = JSON.stringify(input); const prior = data.scheduleCommands[key]
    if (prior) { if (prior.fingerprint!==fingerprint) return reject('22023','DOCTOR_IDEMPOTENCY_CONFLICT'); send(prior.result); return true }
    const before = configuration(); if (before.version!==input.p_expected_version) return reject('40001','DOCTOR_AVAILABILITY_CONFLICT')
    data.scheduleRules[location.id] = { slot_minutes: form.slotMinutes,weekly: form.weekly.map(item => ({ ...item })),exceptions: form.exceptions.map(item => ({ ...item,windows: item.windows.map(window => ({ ...window })) })),version: before.version+1 }
    const result = configuration(); data.scheduleCommands[key] = { fingerprint,result }; data.scheduleEvents.push({ actor: actor.id,practice_id: input.p_practice,location_id: location.id,before,after: result,appointments_changed: false }); send(result); return true
  }
  const day = input.p_day; const earliest = doctorAvailabilityToday(location.timezone); const latest = new Date(`${earliest}T00:00:00Z`); latest.setUTCDate(latest.getUTCDate()+365)
  if (typeof day!=='string' || day<earliest || day>latest.toISOString().slice(0,10)) return reject('22023','DOCTOR_AVAILABILITY_DATE_INVALID')
  const config = configuration(); const special = config.exceptions.find(item => item.date===day)
  const windows = special ? special.closed ? [] : special.windows : config.weekly.filter(item => item.weekday===new Date(`${day}T12:00:00Z`).getUTCDay())
  const slots = []; const doctor = data.practices.find(item => item.id===input.p_practice).owner_user_id
  for (const window of windows) for (let minute=window.start;minute+config.slot_minutes<=window.end;minute+=config.slot_minutes) {
    const start = instant(day,minute,location.timezone); const end = instant(day,minute+config.slot_minutes,location.timezone)
    const busy = data.scheduleCommitments.some(item => item.doctor_user_id===doctor && item.state==='booked' && Date.parse(item.starts_at)<Date.parse(end) && Date.parse(item.ends_at)>Date.parse(start))
    const reason = Date.parse(start)<=Date.now() ? 'past' : busy ? 'busy' : null
    slots.push({ minute,starts_at: start,ends_at: end,available: !reason,reason })
  }
  send({ practice_id: input.p_practice,location_id: location.id,date: day,timezone: location.timezone,location_version: location.version,schedule_version: config.version,slot_minutes: config.slot_minutes,slots,override_policy: 'deny' }); return true
}
