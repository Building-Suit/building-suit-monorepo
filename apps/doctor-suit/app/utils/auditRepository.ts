import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorAuditResult,type DoctorAuditQuery,type DoctorAuditScope } from './administrativeAudit'
export function doctorAuditRepository(client: SupabaseClient<Database>) {
  return { async load(scope: DoctorAuditScope,query: DoctorAuditQuery,signal: AbortSignal) {
    const result = scope.kind==='personal' ? await client.rpc('doctor_personal_account_audit',{ p_query: query.search,p_page: query.page }).abortSignal(signal)
      : await client.rpc('doctor_administrative_audit',{ p_practice: scope.practiceId!,p_location: scope.locationId ?? undefined,p_query: query.search,p_page: query.page }).abortSignal(signal)
    if(result.error)throw result.error;return doctorAuditResult(result.data)
  } }
}
