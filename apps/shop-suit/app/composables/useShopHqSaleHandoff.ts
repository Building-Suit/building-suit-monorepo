import type { ShopHqSaleSelection } from '#shared/shopHqSale'
import { useShopScopeStore } from '~/stores/scope'

interface PendingSale {
  scope: string
  expiresAt: number
  selection: ShopHqSaleSelection
}

export function useShopHqSaleHandoff() {
  const user = useSupabaseUser()
  const router = useRouter()
  const { currentId, currentLocationId, currentMembership, isOwner } = useShop()
  const scopeStore = useShopScopeStore()
  const pending = useState<PendingSale | null>('shop-hq-pending-sale', () => null)
  const scope = computed(() => {
    const actor = user.value?.id
    const shop = currentId.value
    const location = currentLocationId.value
    const membership = currentMembership.value?.id
    return actor && shop && location && membership && isOwner.value
      ? JSON.stringify([actor, scopeStore.revision, shop, location, membership])
      : null
  })

  watch(scope, value => {
    if (pending.value && pending.value.scope !== value) pending.value = null
  }, { flush: 'sync' })

  async function openSale(selection: ShopHqSaleSelection): Promise<boolean> {
    if (import.meta.server || !scope.value) return false
    pending.value = { scope: scope.value, expiresAt: Date.now() + 60_000, selection }
    const ticket = pending.value
    try {
      await navigateTo('/pos')
      if (router.currentRoute.value.path === '/pos') return true
    } catch { /* Keep the prepared selection in chat if navigation fails. */ }
    if (pending.value === ticket) pending.value = null
    return false
  }

  function takeSale() {
    if (import.meta.server) return null
    const ticket = pending.value
    pending.value = null
    return ticket && ticket.scope === scope.value && ticket.expiresAt > Date.now() ? ticket.selection : null
  }

  return { pending: readonly(pending), scope, openSale, takeSale }
}
