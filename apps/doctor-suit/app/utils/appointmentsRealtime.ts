import type { SupabaseClient } from '@supabase/supabase-js'
import { createScopedRealtime } from '@building-suit/data-access'
import type { Database } from '../types/database.types'
import type { DoctorLocationContext } from './locationContext'
import { doctorScopeKey } from './contextScope'
export function createDoctorAppointmentsRealtime(client: SupabaseClient<Database> | null,onDisconnect: () => void) {
  const realtime = client ? createScopedRealtime(client) : null
  return {
    async update(selected: DoctorLocationContext | null,refresh: () => Promise<void>) {
      if(!realtime)return
      await realtime.update(selected ? {
        scope: { environment: selected.environment,portal: selected.portal,userId: selected.userId,sessionId: selected.sessionId,tenantId: selected.practiceId,locationId: selected.locationId,contextKey: doctorScopeKey(selected,'appointments') },
        filters: [{ schema: 'public',table: 'appointment_queue_revisions',event: '*',filter: `location_id=eq.${selected.locationId}` }],dataKeys: ['appointments'],
        refresh: async request => { if(request.isCurrent())await refresh() },onError: onDisconnect,
      } : null)
    },
    get connected() { return realtime?.connected || false },
    async dispose() { await realtime?.dispose() },
  }
}
