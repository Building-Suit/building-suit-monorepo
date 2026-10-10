import {
  clearNuxtData,
  refreshNuxtData,
  useCookie,
  useNuxtApp,
  useState,
  useSupabaseClient,
  useSupabaseUser,
} from '#imports'
import { computed } from 'vue'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

export interface ShopSummary {
  id: string
  name: string
  status: string
  business_mode: 'product' | 'service' | 'mixed'
  created_at: string
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

type PortalRow = { id: string }
type ProfileRow = {
  id: string
  display_name: string | null
  email_snapshot: string | null
  status: string
}
type MembershipRow = Pick<ShopMembership, 'id' | 'shop_id' | 'profile_id' | 'role' | 'status'>

const SHOP_STORAGE_KEY = 'shop-suit.shop'
const LOCATION_STORAGE_KEY = 'shop-suit.location'

export function useShop() {
  const nuxtApp = useNuxtApp()
  const supabase = useSupabaseClient()
  const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const user = useSupabaseUser()
  const selectedShopCookie = useCookie<string | null>(SHOP_STORAGE_KEY, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  const selectedLocationCookie = useCookie<string | null>(LOCATION_STORAGE_KEY, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  const shops = useState<ShopSummary[]>('shop:shops', () => [])
  const memberships = useState<ShopMembership[]>('shop:memberships', () => [])
  const currentId = useState<string | null>('shop:current-id', () => null)
  const locations = useState<ShopLocation[]>('shop:locations', () => [])
  const currentLocationId = useState<string | null>('shop:current-location-id', () => null)
  const loading = useState('shop:loading', () => false)
  const loadError = useState<string | null>('shop:load-error', () => null)
  const loadedUserId = useState<string | null>('shop:loaded-user-id', () => null)
  const loadVersion = useState('shop:load-version', () => 0)
  const locationVersion = useState('shop:location-version', () => 0)

  const current = computed(() => shops.value.find(shop => shop.id === currentId.value) ?? null)
  const currentMembership = computed(() => memberships.value.find(member => member.shop_id === currentId.value) ?? null)
  const currentLocation = computed(() => locations.value.find(location => location.id === currentLocationId.value) ?? null)
  const activeLocations = computed(() => locations.value.filter(location => location.status === 'active'))
  const isOwner = computed(() => currentMembership.value?.role === 'owner')

  function clearShopScopedData() {
    return nuxtApp.runWithContext(() => clearNuxtData(key => key.startsWith('shop-data:')))
  }

  function clearShopState() {
    locationVersion.value += 1
    clearShopScopedData()
    shops.value = []
    memberships.value = []
    locations.value = []
    currentId.value = null
    currentLocationId.value = null
    loadedUserId.value = null
  }

  function resetSession() {
    // Invalidate pending membership/location reads before clearing visible state.
    loadVersion.value += 1
    clearShopState()
    loading.value = false
    loadError.value = null
    selectedShopCookie.value = null
    selectedLocationCookie.value = null
  }

  async function loadLocations(shopId: string | null = currentId.value) {
    const version = ++locationVersion.value
    const userId = user.value?.id
    locations.value = []
    currentLocationId.value = null
    if (!shopId) {
      selectedLocationCookie.value = null
      return
    }
    const { data, error } = await shopRpc.rpc('list_shop_locations', { p_shop_id: shopId })
    if (version !== locationVersion.value || user.value?.id !== userId || currentId.value !== shopId) return
    if (error) throw error
    locations.value = (data ?? []) as ShopLocation[]
    const selectable = locations.value.filter(location => location.status === 'active')
    const remembered = selectedLocationCookie.value
    const nextId = selectable.some(location => location.id === remembered)
      ? remembered
      : (selectable.find(location => location.is_default)?.id ?? selectable[0]?.id ?? null)
    currentLocationId.value = nextId
    selectedLocationCookie.value = nextId
  }

  async function loadShops(options: { force?: boolean } = {}) {
    const userId = user.value?.id
    if (!userId) {
      resetSession()
      return
    }
    if (!options.force && loadedUserId.value === userId) return

    const version = ++loadVersion.value
    // Hide the previous account immediately, including while membership reads wait.
    if (loadedUserId.value !== userId) clearShopState()
    loading.value = true
    loadError.value = null
    try {
      const { data: portalData, error: portalError } = await supabase
        .from('portals')
        .select('id')
        .eq('key', 'shop-crm')
        .eq('is_active', true)
        .maybeSingle()
      if (portalError) throw portalError
      const portal = portalData as PortalRow | null
      if (!portal) throw new Error('Shop Suit portal is unavailable')

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id,display_name,email_snapshot,status')
        .eq('user_id', userId)
        .eq('portal_id', portal.id)
        .maybeSingle()
      if (profileError) throw profileError
      const profile = profileData as ProfileRow | null
      if (version !== loadVersion.value || user.value?.id !== userId) return

      if (!profile || profile.status !== 'active') {
        clearShopState()
        loadedUserId.value = userId
        selectedShopCookie.value = null
        selectedLocationCookie.value = null
        return
      }

      const { data: memberRows, error: memberError } = await supabase
        .from('shop_memberships')
        .select('id,shop_id,profile_id,role,status')
        .eq('profile_id', profile.id)
        .eq('status', 'active')
      if (memberError) throw memberError
      if (version !== loadVersion.value || user.value?.id !== userId) return

      const nextMemberships: ShopMembership[] = ((memberRows ?? []) as MembershipRow[]).map(member => ({
        ...member,
        full_name: profile.display_name,
        email: profile.email_snapshot,
      }))
      const shopIds = nextMemberships.map(member => member.shop_id)
      if (!shopIds.length) {
        clearShopState()
        loadedUserId.value = userId
        selectedShopCookie.value = null
        selectedLocationCookie.value = null
        return
      }

      const { data: shopRows, error: shopError } = await supabase
        .from('shops')
        .select('id,name,status,business_mode,created_at')
        .in('id', shopIds)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
      if (shopError) throw shopError
      if (version !== loadVersion.value || user.value?.id !== userId) return

      shops.value = (shopRows ?? []) as ShopSummary[]
      memberships.value = nextMemberships.filter(member => shops.value.some(shop => shop.id === member.shop_id))

      const remembered = selectedShopCookie.value
      const rememberedIsValid = shops.value.some(shop => shop.id === remembered)
      const nextId = rememberedIsValid ? remembered : (shops.value[0]?.id ?? null)
      if (currentId.value !== nextId) {
        clearShopScopedData()
        currentId.value = nextId
      }
      selectedShopCookie.value = nextId
      await loadLocations(nextId)
      if (version !== loadVersion.value || user.value?.id !== userId) return
      loadedUserId.value = userId
    }
    catch (error) {
      if (version !== loadVersion.value || user.value?.id !== userId) return
      clearShopState()
      selectedShopCookie.value = null
      selectedLocationCookie.value = null
      loadError.value = error instanceof Error ? error.message : 'Unable to load shops'
    }
    finally {
      if (version === loadVersion.value) loading.value = false
    }
  }

  async function selectShop(shopId: string) {
    if (currentId.value === shopId || !shops.value.some(shop => shop.id === shopId)) return
    const version = ++loadVersion.value
    const userId = user.value?.id
    loading.value = true
    loadError.value = null
    clearShopScopedData()
    currentId.value = shopId
    selectedShopCookie.value = shopId
    try {
      await loadLocations(shopId)
      if (version !== loadVersion.value || user.value?.id !== userId) return
      await nuxtApp.runWithContext(() => refreshNuxtData())
    }
    catch {
      if (version !== loadVersion.value || user.value?.id !== userId) return
      loadError.value = 'Unable to load shop locations'
    }
    finally {
      if (version === loadVersion.value) loading.value = false
    }
  }

  async function selectLocation(locationId: string) {
    if (currentLocationId.value === locationId
      || !activeLocations.value.some(location => location.id === locationId)) return
    clearShopScopedData()
    currentLocationId.value = locationId
    selectedLocationCookie.value = locationId
    await nuxtApp.runWithContext(() => refreshNuxtData())
  }

  async function reload() {
    clearShopScopedData()
    loadedUserId.value = null
    await loadShops({ force: true })
    await nuxtApp.runWithContext(() => refreshNuxtData())
  }

  return {
    shops,
    memberships,
    locations,
    activeLocations,
    current,
    currentId,
    currentLocation,
    currentLocationId,
    currentMembership,
    isOwner,
    loading,
    loadError,
    loadShops,
    selectShop,
    selectLocation,
    loadLocations,
    reload,
    resetSession,
  }
}
