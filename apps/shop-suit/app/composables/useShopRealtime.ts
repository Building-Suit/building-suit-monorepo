import { createScopedRealtime } from '@building-suit/data-access'
import { createShopRefreshGate, shopRealtimeFilters, type ShopRealtimeFeature } from '~/utils/shopRealtime'

/** One controller per mounted operational page; request-scoped SSR never subscribes. */
export function useShopRealtime(feature: ShopRealtimeFeature, dirty: () => boolean = () => false) {
  if (import.meta.server) return
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const { currentId, currentLocationId } = useShop()
  const nuxt = useNuxtApp()
  const route = useRoute()
  const environment = useRuntimeConfig().public.supabase.url
  const controller = createScopedRealtime(client)
  let disposed = false
  let generation = 0
  const gate = createShopRefreshGate(dirty, async () => {
    // Refresh only mounted Shop data. Never clear or recreate an open editor.
    await nuxt.runWithContext(() => refreshNuxtData(Object.keys(nuxt.payload.data).filter(key => key.startsWith('shop-data:'))))
  })
  async function bind() {
    const expected = ++generation
    const shop = currentId.value, location = currentLocationId.value, actor = user.value?.id
    if (!shop || !actor) { await controller.update(null); return }
    const { data } = await client.auth.getSession()
    if (disposed || expected !== generation) return
    let sessionId: string | undefined
    try { sessionId = JSON.parse(atob(data.session!.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).session_id } catch { /* no authenticated session: retain manual refresh */ }
    if (!sessionId) { await controller.update(null); return }
    await controller.update({
      scope: { environment, portal: 'shop-crm', userId: actor, tenantId: shop, locationId: location, sessionId, contextKey: `${feature}:${route.fullPath}` },
      filters: shopRealtimeFilters(feature, shop, location), dataKeys: [`shop-data:${feature}`],
      refresh: async request => { if (request.isCurrent()) await gate.invalidate() },
      onError: () => { /* Manual retry remains available; reconnect uses the shared engine. */ },
    })
  }
  watch([currentId, currentLocationId, () => user.value?.id, () => route.fullPath], () => { void bind().catch(() => {}) }, { immediate: true })
  watch(dirty, value => { if (!value) void gate.flush().catch(() => {}) })
  const { data: listener } = client.auth.onAuthStateChange(() => { void bind().catch(() => {}) })
  onScopeDispose(() => { disposed = true; ++generation; listener.subscription.unsubscribe(); gate.dispose(); void controller.dispose().catch(() => {}) })
}
