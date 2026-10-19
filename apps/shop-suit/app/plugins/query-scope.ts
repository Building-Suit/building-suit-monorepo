import { useMutationCache, useQueryCache } from '@pinia/colada'
import { useShopScopeStore } from '~/stores/scope'
import { usePosReceiptStore } from '~/stores/posReceipt'

export default defineNuxtPlugin({
  name: 'shop-query-scope', dependsOn: ['Pinia Colada'],
  setup() {
    const user = useSupabaseUser()
    const session = useSupabaseSession()
    const scope = useShopScopeStore()
    const cache = useQueryCache()
    const mutations = useMutationCache()
    const posReceipt = usePosReceiptStore()
    watch(() => user.value?.id ?? null, actor => {
      if (actor === scope.actorId) return
      scope.revision++
      scope.actorId = actor
      scope.shopId = null; scope.locationId = null
    }, { immediate: true, flush: 'sync' })

    let sessionIdentity: string | null = null
    watch(session, value => {
      let identity: string | null = null
      try {
        // This claim only partitions caches. Supabase still verifies every request.
        identity = JSON.parse(atob(value!.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).session_id ?? null
      } catch { /* No provider session yet. */ }
      if (identity && sessionIdentity && identity !== sessionIdentity) scope.revision++
      sessionIdentity = identity
    }, { immediate: true, flush: 'sync' })

    watch([() => scope.revision, () => scope.shopId, () => scope.locationId, () => scope.publicAccessRevision], () => {
      posReceipt.selectScope(JSON.stringify([scope.actorId, scope.revision, scope.shopId, scope.locationId]))
      for (const entry of cache.getEntries({ predicate: entry => {
        if (entry.key[0] !== 'shop-suit') return false
        if (entry.key[4] !== (user.value?.id ?? 'anonymous') || entry.key[5] !== scope.revision) return true
        if (entry.key[6] === 'context') return false
        if (entry.key[6] === 'locations') return entry.key[7] !== scope.shopId
        return entry.key[6] !== '*' && entry.key[6] !== (scope.shopId ?? 'none') || entry.key[7] !== '*' && entry.key[7] !== (scope.locationId ?? 'none') || entry.key[8] !== scope.publicAccessRevision
      } })) {
        // Detached late responses cannot become another account/shop's cached snapshot.
        cache.cancel(entry); cache.remove(entry)
      }
      for (const entry of mutations.getEntries({ predicate: entry => entry.meta.shopMutation === true })) mutations.remove(entry)
    }, { immediate: true, flush: 'sync' })
  },
})
