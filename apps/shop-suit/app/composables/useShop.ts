import { storeToRefs } from 'pinia'
import { useShopStore } from '~/stores/shop'

export interface ShopSummary {
  id: string
  name: string
  status: string
  business_mode: 'product' | 'service' | 'mixed'
  created_at: string
  business_currency?: string
  currency_locked_at?: string | null
}

export interface ShopMembership {
  id: string
  shop_id: string
  profile_id: string
  role: string
  status: string
  // Kept until the employee page is migrated; the current Shop contract does not store these
  // fields on a membership row.
  full_name: string | null
  email: string | null
}

export interface ShopLocation {
  id: string
  shop_id: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  status: 'active' | 'archived'
  is_default: boolean
  archived_at: string | null
}

export function useShop() {
  const store = useShopStore()
  return { ...storeToRefs(store), loadShops: store.loadShops, selectShop: store.selectShop, selectLocation: store.selectLocation, loadLocations: store.loadLocations, reload: store.reload, resetSession: store.resetSession, refreshBusinessCurrency: store.refreshBusinessCurrency }
}
