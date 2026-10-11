import type { RealtimeFilter } from '@building-suit/contracts'

// Product ownership belongs here; the shared engine never knows Shop tables.
export const shopRealtimeTables = {
  appointments: ['appointments', 'appointment_schedule_blocks', 'appointment_working_hours'],
  sales: ['invoices', 'payments', 'clients'],
  'cash-shifts': ['cash_sessions', 'cash_drawer_events'],
  team: ['shop_memberships', 'roles', 'membership_location_assignments'],
  customers: ['clients', 'invoices', 'payments'],
  billing: ['shops'],
  products: ['products', 'catalog_categories'],
  services: ['services', 'service_location_availability', 'service_staff_eligibility'],
  inventory: ['products', 'inventory_batches', 'inventory_movements'],
  pos: ['products', 'services', 'clients', 'appointments', 'cash_sessions'],
} as const
export type ShopRealtimeFeature = keyof typeof shopRealtimeTables
export function shopRealtimeFilters(feature: ShopRealtimeFeature, shopId: string, locationId: string | null): RealtimeFilter[] {
  if (!/^[a-zA-Z0-9-]+$/.test(shopId) || locationId !== null && !/^[a-zA-Z0-9-]+$/.test(locationId)) throw new Error('Invalid Shop realtime context')
  const keys = [`${shopId}:all:${feature}`, ...(locationId ? [`${shopId}:${locationId}:${feature}`] : [])]
  return keys.flatMap(key => ['INSERT', 'UPDATE'].map(event => ({ schema: 'public', table: 'shop_realtime_versions', event: event as 'INSERT' | 'UPDATE', filter: `scope_key=eq.${key}` })))
}

/** Defer invalidations while the shared record-action controller protects an editor. */
export function createShopRefreshGate(isDirty: () => boolean, refresh: () => Promise<void>) {
  let stale = false
  let disposed = false
  return {
    get stale() { return stale },
    async invalidate() { if (disposed) return; stale = true; await this.flush() },
    async flush() { if (disposed || !stale || isDirty()) return; stale = false; try { await refresh() } catch (error) { stale = true; throw error } },
    dispose() { disposed = true; stale = false },
  }
}
