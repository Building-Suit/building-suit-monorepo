import { createPostgresReadinessBarrier } from '@building-suit/data-access/postgres-readiness'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createScopedRealtime,type RealtimeChannel } from '@building-suit/data-access'
import type { Database } from '../types/database.types'
import type { DoctorLocationContext } from './locationContext'
import { doctorScopeKey } from './contextScope.ts'
export function createDoctorAppointmentsRealtime(client: SupabaseClient<Database> | null,onDisconnect: () => void) {
  const realtime = client ? createScopedRealtime({
    // The pinned provider can acknowledge a channel before Postgres delivery is
    // active. Hold admission so the shared join/reconnect refresh closes that gap.
    channel(name) {
      const raw = client.channel(name,{ config: { postgres_changes_options: { wait: true } } })
      const barrier = createPostgresReadinessBarrier(callback => raw.on('system',{},callback),callback => raw.subscribe(callback))
      return { raw,dispose: barrier.dispose,on: (...args: Parameters<RealtimeChannel['on']>) => raw.on(...args),subscribe: barrier.subscribe }
    },
    removeChannel(channel) { channel.dispose();return client.removeChannel(channel.raw) },
  }) : null
  return {
    async update(selected: DoctorLocationContext | null,refresh: () => Promise<void>) {
      if(!realtime)return
      await realtime.update(selected ? {
        scope: { environment: selected.environment,portal: selected.portal,userId: selected.userId,sessionId: selected.sessionId,tenantId: selected.practiceId,locationId: selected.locationId,contextKey: doctorScopeKey(selected,'appointments') },
        filters: [
          { schema: 'public',table: 'appointment_queue_revisions',event: 'INSERT',filter: `location_id=eq.${selected.locationId}` },
          { schema: 'public',table: 'appointment_queue_revisions',event: 'UPDATE',filter: `location_id=eq.${selected.locationId}` },
        ],dataKeys: ['appointments'],
        refresh: async request => { if(request.isCurrent())await refresh() },onError: onDisconnect,
      } : null)
    },
    get connected() { return realtime?.connected || false },
    async dispose() { await realtime?.dispose() },
  }
}
