import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorPatientDirectory,doctorPatientDuplicates,doctorPatientResult,type DoctorPatientForm,type DoctorPatientQuery,type DoctorPatientRow } from './patients.ts'
const input = (form: DoctorPatientForm) => ({ name: form.name,phone: form.phone,email: form.email,date_of_birth: form.dateOfBirth || null })
export function doctorPatientsRepository(client: SupabaseClient<Database>) {
  return {
    async load(practiceId: string,locationId: string,query: DoctorPatientQuery,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_patients',{ p_practice: practiceId,p_location: locationId,p_page: query.page,p_size: query.size,p_search: query.search,p_status: query.status }).abortSignal(signal)
      if (error) throw error
      return doctorPatientDirectory(data,practiceId)
    },
    async duplicates(practiceId: string,locationId: string,form: DoctorPatientForm,row: DoctorPatientRow | null,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_patient_duplicate_review',{ p_practice: practiceId,p_location: locationId,p_input: input(form),...(row ? { p_patient: row.id } : {}) }).abortSignal(signal)
      if (error) throw error
      return doctorPatientDuplicates(data,practiceId)
    },
    async write(practiceId: string,locationId: string,form: DoctorPatientForm,row: DoctorPatientRow | null,key: string,reviewKey: string | null,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_write_patient',{ p_practice: practiceId,p_location: locationId,p_input: input(form),p_key: key,...(row ? { p_patient: row.id,p_expected_version: row.version } : {}),...(reviewKey ? { p_duplicate_review: reviewKey } : {}) }).abortSignal(signal)
      if (error) throw error
      return doctorPatientResult(data)
    },
    async archive(practiceId: string,locationId: string,row: DoctorPatientRow,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_archive_patient',{ p_practice: practiceId,p_location: locationId,p_patient: row.id,p_expected_version: row.version,p_key: key }).abortSignal(signal)
      if (error) throw error
      return doctorPatientResult(data)
    },
  }
}
