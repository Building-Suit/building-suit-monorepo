import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorLocationDirectory, type DoctorLocationForm, type DoctorLocationQuery, type DoctorLocationRow } from './locations.ts'
export function doctorLocationsRepository(client: SupabaseClient<Database>) {
  return {
    async load(practiceId: string, query: DoctorLocationQuery, signal: AbortSignal) {
      const { data, error } = await client.rpc('doctor_locations', { p_practice: practiceId, p_page: query.page, p_size: query.size, p_search: query.search }).abortSignal(signal)
      if (error) throw error
      return doctorLocationDirectory(data, practiceId)
    },
    async write(practiceId: string, row: DoctorLocationRow | null, form: DoctorLocationForm, key: string, signal: AbortSignal) {
      const { error } = await client.rpc('doctor_write_location', { p_practice: practiceId, p_name: form.name, p_timezone: form.timezone, p_phone: form.phone, p_address: form.address, p_key: key, ...(row ? { p_location: row.id, p_expected_version: row.version } : {}) }).abortSignal(signal)
      if (error) throw error
    },
    async archive(practiceId: string, row: DoctorLocationRow, key: string, signal: AbortSignal) {
      const { error } = await client.rpc('doctor_archive_location', { p_practice: practiceId, p_location: row.id, p_expected_version: row.version, p_key: key }).abortSignal(signal)
      if (error) throw error
    },
  }
}
