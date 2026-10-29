import { discardShopQuery } from '~/utils/shopQueryCleanup'
import { defineStore } from 'pinia'
import { useQuery, useQueryCache } from '@pinia/colada'
import { computed, watch, nextTick } from 'vue'
import { useShopQueryCache } from '~/composables/useShopQueryCache'
import { useShopScopeStore } from './scope'
import type { ShopSummary, ShopMembership, ShopLocation } from '~/composables/useShop'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

type Profile = { id: string; display_name: string | null; email_snapshot: string | null; status: string }
type Snapshot = { actorId: string | null; shops: ShopSummary[]; memberships: ShopMembership[] }

export const useShopStore = defineStore('shop-context', () => {
  const user = useSupabaseUser()
  const client = useShopClient()
  const rpc = useShopClient<ShopRpcDatabase>().schema('public')
  const config = useRuntimeConfig()
  const cache = useQueryCache()
  const queries = useShopQueryCache()
  const scope = useShopScopeStore()
  const shopCookie = useCookie<string | null>('shop-suit.shop', { path: '/', maxAge: 31536000 })
  const locationCookie = useCookie<string | null>('shop-suit.location', { path: '/', maxAge: 31536000 })
  const identity = () => ['shop-suit', config.public.supabase.url, config.public.appEnvironment, 'shop-crm', user.value?.id ?? 'anonymous', scope.revision] as const
  const snapshotKey = computed(() => [...identity(), 'context'])
  const snapshot = useQuery<Snapshot>({
    key: snapshotKey, enabled: () => Boolean(user.value), meta: { shopResource: 'shop-context' },
    query: async ({ signal }) => {
      const actor = user.value?.id
      if (!actor) return { actorId: actor ?? null, shops: [], memberships: [] }
      const portal = await client.from('portals').select('id').eq('key', 'shop-crm').eq('is_active', true).abortSignal(signal).maybeSingle()
      if (portal.error) throw portal.error
      if (!portal.data) throw new Error('Shop Suit portal is unavailable')
      const result = await client.from('profiles').select('id,display_name,email_snapshot,status').eq('user_id', actor).eq('portal_id', portal.data.id).abortSignal(signal).maybeSingle()
      if (result.error) throw result.error
      const profile = result.data as Profile | null
      if (!profile || profile.status !== 'active') return { actorId: actor ?? null, shops: [], memberships: [] }
      const members = await client.from('shop_memberships').select('id,shop_id,profile_id,role,status').eq('profile_id', profile.id).eq('status', 'active').abortSignal(signal)
      if (members.error) throw members.error
      const memberships = (members.data ?? []).map(member => ({ ...member, full_name: profile.display_name, email: profile.email_snapshot })) as ShopMembership[]
      if (!memberships.length) return { actorId: actor ?? null, shops: [], memberships: [] }
      const resultShops = await client.from('shops').select('id,name,status,business_mode,created_at,business_currency,currency_locked_at').in('id', memberships.map(member => member.shop_id)).eq('status', 'active').order('created_at', { ascending: true }).abortSignal(signal)
      if (resultShops.error) throw resultShops.error
      const shops = (resultShops.data ?? []) as ShopSummary[]
      return { actorId: actor, shops, memberships: memberships.filter(member => shops.some(shop => shop.id === member.shop_id)) }
    },
  })
  const shops = computed(() => { const value = snapshot.data.value; return value && value.actorId === user.value?.id ? value.shops : [] })
  const memberships = computed(() => { const value = snapshot.data.value; return value && value.actorId === user.value?.id ? value.memberships : [] })
  const currentId = computed({ get: () => scope.shopId, set: value => { scope.shopId = value } })
  const currentLocationId = computed({ get: () => scope.locationId, set: value => { scope.locationId = value } })
  const current = computed(() => shops.value.find(shop => shop.id === currentId.value) ?? null)
  const currentMembership = computed(() => memberships.value.find(member => member.shop_id === currentId.value) ?? null)
  const locationKey = computed(() => [...identity(), 'locations', currentId.value ?? 'none'])
  const locationQuery = useQuery<{ actorId: string | null; shopId: string | null; rows: ShopLocation[] }>({
    key: locationKey, enabled: () => Boolean(user.value && current.value), meta: { shopResource: 'shop-locations' },
    query: async ({ signal }) => {
      const shopId = currentId.value
      const actorId = user.value?.id ?? null
      if (!shopId) return { actorId, shopId, rows: [] }
      const result = await rpc.rpc('list_shop_locations', { p_shop_id: shopId }).abortSignal(signal)
      if (result.error) throw result.error
      return { actorId, shopId, rows: (result.data ?? []) as ShopLocation[] }
    },
  })
  const locations = computed(() => { const value = locationQuery.data.value; return value && value.actorId === user.value?.id && value.shopId === currentId.value ? value.rows : [] })
  const activeLocations = computed(() => locations.value.filter(location => location.status === 'active'))
  const currentLocation = computed(() => activeLocations.value.find(location => location.id === currentLocationId.value) ?? null)
  const businessCurrency = computed(() => current.value?.business_currency ?? 'EGP')
  const isOwner = computed(() => currentMembership.value?.role === 'owner')
  const loading = computed(() => Boolean(user.value) && (snapshot.isPending.value || Boolean(currentId.value && locationQuery.isPending.value)))
  const loadError = computed(() => snapshot.error.value?.message ?? locationQuery.error.value?.message ?? null)

  watch([() => user.value?.id, () => snapshot.data.value], ([actor, value]) => {
    if (!actor || !value || value.actorId !== actor) { currentId.value = null; currentLocationId.value = null; return }
    const selected = [currentId.value, shopCookie.value].find(id => value.shops.some(shop => shop.id === id)) ?? value.shops[0]?.id ?? null
    if (selected !== currentId.value) currentLocationId.value = null
    currentId.value = selected
    shopCookie.value = selected
  }, { immediate: true, flush: 'sync' })
  watch(() => locationQuery.data.value, value => {
    if (!value || value.actorId !== user.value?.id || value.shopId !== currentId.value) { currentLocationId.value = null; return }
    const available = value.rows.filter(location => location.status === 'active')
    const selected = [currentLocationId.value, locationCookie.value].find(id => available.some(location => location.id === id)) ?? available.find(location => location.is_default)?.id ?? available[0]?.id ?? null
    currentLocationId.value = selected
    locationCookie.value = selected
  }, { immediate: true, flush: 'sync' })
  async function loadLocations(shopId = currentId.value) {
    if (!shopId || shopId !== currentId.value) return
    const entry = cache.get(locationKey.value)
    if (entry && !entry.pending) entry.when = 0
    queries.markStale(resource => resource === 'rpc:list_shop_locations')
    await locationQuery.refresh()
  }
  async function loadShops(options: { force?: boolean } = {}) {
    if (!user.value) return
    const entry = cache.get(snapshotKey.value)
    if (options.force) { if (entry && !entry.pending) entry.when = 0; queries.markStale(resource => resource.startsWith('table:')) }
    await snapshot.refresh()
    await nextTick()
    if (currentId.value) {
      const locations = cache.get(locationKey.value)
      if (options.force && locations && !locations.pending) locations.when = 0
      if (options.force) queries.markStale(resource => resource === 'rpc:list_shop_locations')
      await locationQuery.refresh()
    }
  }
  async function selectShop(id: string) {
    if (id === currentId.value || !shops.value.some(shop => shop.id === id)) return
    currentLocationId.value = null
    currentId.value = id
    shopCookie.value = id
    await nextTick()
    await locationQuery.refresh()
  }
  function selectLocation(id: string) {
    if (id !== currentLocationId.value && activeLocations.value.some(location => location.id === id)) { currentLocationId.value = id; locationCookie.value = id }
  }
  function resetSession() {
    const actor = user.value?.id
    for (const entry of cache.getEntries({ predicate: entry => entry.key[0] === 'shop-suit' && entry.key[4] === actor })) { discardShopQuery(cache, entry) }
    scope.revision++
    scope.shopId = null; scope.locationId = null
    shopCookie.value = null; locationCookie.value = null
  }
  async function refreshBusinessCurrency(shopId: string) {
    if (shopId !== currentId.value) return
    const key = snapshotKey.value
    const result = await rpc.rpc('business_currency_settings', { p_shop_id: shopId })
    if (result.error) throw result.error
    const settings = result.data as { currency?: string; lockedAt?: string | null } | null
    if (!settings?.currency || !/^[A-Z]{3}$/.test(settings.currency)) throw new Error('Invalid business currency response')
    if (key.join(':') !== snapshotKey.value.join(':') || shopId !== currentId.value) return
    const value = snapshot.data.value
    if (value) cache.setQueryData(key, { ...value, shops: value.shops.map(shop => shop.id === shopId ? { ...shop, business_currency: settings.currency, currency_locked_at: settings.lockedAt ?? null } : shop) })
    await queries.refresh(resource => resource.startsWith('shop-data:') && !resource.includes('permission'))
  }
  async function reload() {
    await loadShops({ force: true })
    await queries.refresh(resource => resource.startsWith('shop-data:'))
  }
  return { shops, memberships, locations, activeLocations, current, businessCurrency, currentId, currentLocation, currentLocationId, currentMembership, isOwner, loading, loadError, loadShops, selectShop, selectLocation, loadLocations, reload, resetSession, refreshBusinessCurrency }
})
