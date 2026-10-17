import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorPracticeSetup, doctorSetupDraft, type DoctorSetupForm } from './practiceSetup'

function checked(error: unknown) { if (error) throw error }
export function doctorPracticeRepository(client: SupabaseClient<Database>) {
  return {
    async load(signal: AbortSignal) {
      const { data, error } = await client.rpc('doctor_practice_setup').abortSignal(signal)
      checked(error); return doctorPracticeSetup(data)
    },
    async save(form: DoctorSetupForm, key: string, expectedVersion: number, signal: AbortSignal) {
      const { data, error } = await client.rpc('doctor_save_onboarding_draft', { p_key: key, p_expected_version: expectedVersion, p_display_name: form.displayName, p_practice_name: form.practiceName, p_location_name: form.locationName, p_timezone: form.timezone }).abortSignal(signal)
      checked(error); return doctorSetupDraft(data)
    },
    async complete(key: string, draftVersion: number, signal: AbortSignal) {
      const { error } = await client.rpc('doctor_complete_onboarding', { p_key: key, p_draft_version: draftVersion }).abortSignal(signal)
      checked(error)
    },
    async update(practice: { id: string; version: number }, form: DoctorSetupForm, key: string, signal: AbortSignal) {
      const { error } = await client.rpc('doctor_update_practice_profile', { p_practice: practice.id, p_expected_version: practice.version, p_display_name: form.displayName, p_practice_name: form.practiceName, p_key: key }).abortSignal(signal)
      checked(error)
    },
  }
}
