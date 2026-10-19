import { doctorUuid } from './locationContext.ts'
import { doctorScheduleDate } from './availability.ts'
export function doctorDashboardSource(query: Record<string,unknown>,scope: { practiceId: string; locationId: string }|null): { appointmentId: string; date: string; page: number; queuePage: number }|'denied'|null {
  if(query.appointment===undefined)return null
  const page = (value: unknown) => value===undefined ? 0 : typeof value==='string' && /^(0|[1-9]\d{0,5})$/.test(value) && Number(value)<=100000 ? Number(value) : null
  const dayPage = page(query.page);const queuePage = page(query.queuePage)
  if(dayPage===null || queuePage===null)return 'denied'
  if(!scope || !doctorUuid(query.appointment) || query.practice!==scope.practiceId || query.location!==scope.locationId || typeof query.day!=='string' || !doctorScheduleDate(query.day))return 'denied'
  return { appointmentId: query.appointment,date: query.day,page: dayPage,queuePage }
}
