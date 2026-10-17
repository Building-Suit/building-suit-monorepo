import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorAccountSettings,type DoctorAccountForm } from './accountSettings'
export function doctorAccountRepository(client: SupabaseClient<Database>) {
  return {
    async load(signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_account_settings').abortSignal(signal)
      if(error)throw error;return doctorAccountSettings(data)
    },
    async update(form: DoctorAccountForm,version: number,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_update_account_settings',{ p_personal_name: form.personalName,p_contact_phone: form.contactPhone,p_in_app_confirmations: form.inAppConfirmations,p_expected_version: version,p_key: key }).abortSignal(signal)
      if(error)throw error;return doctorAccountSettings(data)
    },
  }
}
