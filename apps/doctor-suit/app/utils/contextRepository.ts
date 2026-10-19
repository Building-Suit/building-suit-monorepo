import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
export function doctorContextRepository(client: SupabaseClient<Database>) {
  return {
    async load(signal: AbortSignal): Promise<unknown> {
      const { data, error } = await client.rpc('doctor_contexts').abortSignal(signal)
      if (error) throw error
      return data
    },
    async resolve(practiceId: string, locationId: string, version: number, signal: AbortSignal): Promise<unknown> {
      const { data, error } = await client.rpc('doctor_resolve_context', { p_practice: practiceId, p_location: locationId, p_expected_version: version }).abortSignal(signal)
      if (error) throw error
      return data
    },
  }
}
