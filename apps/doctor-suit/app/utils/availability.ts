import { doctorUuid } from './locationContext.ts'
export interface DoctorTimeWindow { start: number; end: number }
export interface DoctorWeekWindow extends DoctorTimeWindow { weekday: number }
export interface DoctorScheduleException { date: string; closed: boolean; windows: DoctorTimeWindow[]; reason: string }
export interface DoctorScheduleInput { slotMinutes: number; weekly: DoctorWeekWindow[]; exceptions: DoctorScheduleException[] }
export interface DoctorSchedule extends DoctorScheduleInput { practiceId: string; locationId: string; timezone: string; locationVersion: number; version: number; canManage: boolean; existingCommitments: number; overridePolicy: 'deny' }
export interface DoctorSlot { minute: number; startsAt: string | null; endsAt: string | null; available: boolean; reason: 'busy' | 'past' | 'ambiguous_or_missing_clock' | 'outside_hours' | 'unconfigured' | null }
export interface DoctorAvailability { practiceId: string; locationId: string; date: string; timezone: string; locationVersion: number; scheduleVersion: number; slotMinutes: number; slots: DoctorSlot[]; overridePolicy: 'deny' }
const record = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const integer = (value: unknown,min: number,max: number): value is number => Number.isSafeInteger(value) && Number(value)>=min && Number(value)<=max
const stamp = (value: unknown): value is string => typeof value==='string' && Number.isFinite(Date.parse(value))
function invalid(): never { throw new Error('DOCTOR_AVAILABILITY_RESPONSE_INVALID') }
export function doctorScheduleDate(value: unknown): value is string {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value<'1900-01-01' || value>'2200-12-31') return false
  const parsed = new Date(`${value}T00:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value
}
export function doctorClockMinute(value: string,end = false): number | null {
  if (end && value==='24:00') return 1440
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0,2))*60+Number(value.slice(3))
}
export function doctorMinuteClock(value: number) { return `${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toString().padStart(2,'0')}` }
export function doctorAvailabilityToday(zone: string,now = new Date()) { const parts = new Intl.DateTimeFormat('en',{ timeZone: zone,year: 'numeric',month: '2-digit',day: '2-digit' }).formatToParts(now); return ['year','month','day'].map(type => parts.find(item => item.type===type)?.value || '').join('-') }
export function doctorScheduleWindows(value: unknown,weekly: true): DoctorWeekWindow[]
export function doctorScheduleWindows(value: unknown,weekly: false): DoctorTimeWindow[]
export function doctorScheduleWindows(value: unknown,weekly: boolean): DoctorWeekWindow[] | DoctorTimeWindow[] {
  if (!Array.isArray(value) || value.length>(weekly ? 28 : 4)) invalid()
  const windows = value.map(item => {
    if (!record(item) || Object.keys(item).some(key => !['start','end',...(weekly ? ['weekday'] : [])].includes(key)) || !integer(item.start,0,1439) || !integer(item.end,1,1440) || item.start>=item.end || (weekly && !integer(item.weekday,0,6))) invalid()
    return { start: item.start,end: item.end,...(weekly ? { weekday: item.weekday as number } : {}) }
  })
  if (windows.some((item,index) => windows.some((other,position) => position<index && (!weekly || other.weekday===item.weekday) && item.start<other.end && item.end>other.start))) invalid()
  return windows as DoctorWeekWindow[] | DoctorTimeWindow[]
}
export function doctorScheduleExceptions(value: unknown): DoctorScheduleException[] {
  if (!Array.isArray(value) || value.length>50) invalid()
  const rows = value.map(item => {
    if (!record(item) || Object.keys(item).some(key => !['date','closed','windows','reason'].includes(key)) || !doctorScheduleDate(item.date) || typeof item.closed!=='boolean' || typeof item.reason!=='string' || !item.reason.trim() || item.reason.length>200 || Array.from(item.reason).some(char => char.charCodeAt(0)<32 || char.charCodeAt(0)===127)) invalid()
    const windows = doctorScheduleWindows(item.windows,false)
    if (item.closed ? windows.length!==0 : windows.length===0) invalid()
    return { date: item.date,closed: item.closed,windows,reason: item.reason }
  })
  if (new Set(rows.map(item => item.date)).size!==rows.length) invalid()
  return rows
}
export function validDoctorSchedule(input: DoctorScheduleInput) {
  try { if (!integer(input.slotMinutes,5,120)) return false; doctorScheduleWindows(input.weekly,true); doctorScheduleExceptions(input.exceptions); return true } catch { return false }
}
export function doctorScheduleInput(config: DoctorScheduleInput): DoctorScheduleInput { return { slotMinutes: config.slotMinutes,weekly: config.weekly.map(item => ({ ...item })),exceptions: config.exceptions.map(item => ({ ...item,windows: item.windows.map(window => ({ ...window })) })) } }
export function doctorSchedule(value: unknown,practiceId: string,locationId: string): DoctorSchedule {
  if (!record(value) || value.practice_id!==practiceId || value.location_id!==locationId || !doctorUuid(practiceId) || !doctorUuid(locationId) || typeof value.timezone!=='string' || !integer(value.location_version,1,2147483647) || !integer(value.version,0,2147483647) || !integer(value.slot_minutes,5,120) || typeof value.can_manage!=='boolean' || value.override_policy!=='deny' || !integer(value.existing_commitments,0,Number.MAX_SAFE_INTEGER)) invalid()
  try { new Intl.DateTimeFormat('en',{ timeZone: value.timezone }) } catch { invalid() }
  return { practiceId,locationId,timezone: value.timezone,locationVersion: value.location_version,version: value.version,slotMinutes: value.slot_minutes,weekly: doctorScheduleWindows(value.weekly,true),exceptions: doctorScheduleExceptions(value.exceptions),canManage: value.can_manage,existingCommitments: value.existing_commitments,overridePolicy: 'deny' }
}
export function doctorAvailability(value: unknown,practiceId: string,locationId: string,day: string): DoctorAvailability {
  if (!record(value) || value.practice_id!==practiceId || value.location_id!==locationId || value.date!==day || !doctorScheduleDate(day) || typeof value.timezone!=='string' || !integer(value.location_version,1,2147483647) || !integer(value.schedule_version,0,2147483647) || !integer(value.slot_minutes,5,120) || value.override_policy!=='deny' || !Array.isArray(value.slots) || value.slots.length>288) invalid()
  try { new Intl.DateTimeFormat('en',{ timeZone: value.timezone }) } catch { invalid() }
  const slots = value.slots.map(item => {
    if (!record(item) || !integer(item.minute,0,1439) || typeof item.available!=='boolean' || !(item.starts_at===null || stamp(item.starts_at)) || !(item.ends_at===null || stamp(item.ends_at)) || (item.available ? item.reason!==null || !stamp(item.starts_at) || !stamp(item.ends_at) || Date.parse(item.ends_at)-Date.parse(item.starts_at)!==Number(value.slot_minutes)*60000 : !['busy','past','ambiguous_or_missing_clock','outside_hours','unconfigured'].includes(String(item.reason)))) invalid()
    return { minute: item.minute,startsAt: item.starts_at as string | null,endsAt: item.ends_at as string | null,available: item.available,reason: item.reason as DoctorSlot['reason'] }
  })
  if (new Set(slots.map(item => item.minute)).size!==slots.length) invalid()
  return { practiceId,locationId,date: day,timezone: value.timezone,locationVersion: value.location_version,scheduleVersion: value.schedule_version,slotMinutes: value.slot_minutes,slots,overridePolicy: 'deny' }
}
