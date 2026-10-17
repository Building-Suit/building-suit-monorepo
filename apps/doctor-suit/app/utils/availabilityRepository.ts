import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorSchedule,doctorAvailability,type DoctorScheduleInput } from './availability.ts'
export function doctorAvailabilityRepository(client: SupabaseClient<Database>) {
  return {
    async load(practiceId: string,locationId: string,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_schedule',{ p_practice: practiceId,p_location: locationId }).abortSignal(signal); if (error) throw error; return doctorSchedule(data,practiceId,locationId) },
    async slots(practiceId: string,locationId: string,date: string,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_availability',{ p_practice: practiceId,p_location: locationId,p_day: date }).abortSignal(signal); if (error) throw error; return doctorAvailability(data,practiceId,locationId,date) },
    async write(practiceId: string,locationId: string,version: number,input: DoctorScheduleInput,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_write_schedule',{ p_practice: practiceId,p_location: locationId,p_expected_version: version,p_key: key,p_input: { slot_minutes: input.slotMinutes,weekly: input.weekly.map(item => ({ ...item })),exceptions: input.exceptions.map(item => ({ ...item,windows: item.windows.map(window => ({ ...window })) })) } }).abortSignal(signal)
      if (error) throw error; return doctorSchedule(data,practiceId,locationId)
    },
  }
}
