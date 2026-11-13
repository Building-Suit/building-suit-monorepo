import { discardShopQuery } from '~/utils/shopQueryCleanup'
import { useQueryCache } from '@pinia/colada'
import { toValue } from 'vue'
import { useShopScopeStore } from '~/stores/scope'

export type ShopQuerySelector = string | string[] | ((resource: string) => boolean)
export type ShopQueryScope = 'location' | 'shop' | 'account'
export function useShopQueryCache() {
  const cache = useQueryCache()
  const scope = useShopScopeStore()
  const config = useRuntimeConfig()
  const user = useSupabaseUser()
  function scopeKey(boundary: ShopQueryScope = 'location') {
    return ['shop-suit', config.public.supabase.url, config.public.appEnvironment, 'shop-crm', user.value?.id ?? 'anonymous', scope.revision,
      boundary === 'account' ? '*' : scope.shopId ?? 'none', boundary === 'location' ? scope.locationId ?? 'none' : '*', scope.publicAccessRevision] as const
  }
  function matches(resource: unknown, selector?: ShopQuerySelector) {
    if (typeof resource !== 'string') return false
    if (!selector) return true
    if (typeof selector === 'function') return selector(resource)
    return (Array.isArray(selector) ? selector : [selector]).some(key => resource === key || resource.startsWith(`${key}:`))
  }
  function entries(selector?: ShopQuerySelector) {
    const identity = scopeKey()
    return cache.getEntries({ predicate: entry => {
      if (entry.key[0] !== 'shop-suit' || entry.key[1] !== identity[1] || entry.key[4] !== identity[4] || entry.key[5] !== identity[5]) return false
      const selected = entry.key[6] === 'context'
        || entry.key[6] === 'locations' && entry.key[7] === identity[6]
        || (entry.key[6] === '*' || entry.key[6] === identity[6]) && (entry.key[7] === '*' || entry.key[7] === identity[7]) && entry.key[8] === identity[8]
      return selected && matches(entry.meta.shopResource, selector)
    } })
  }
  /** Coalesce overlapping refreshes instead of aborting and restarting them. */
  async function refresh(selector?: ShopQuerySelector) {
    markStale(resource => resource.startsWith('rpc:') || resource.startsWith('table:'))
    await Promise.all(entries(selector).map(entry => {
      if (!entry.pending) entry.when = 0
      return entry.active && toValue(entry.options?.enabled) && cache.refresh(entry)
    }))
  }
  function clear(selector?: ShopQuerySelector) {
    for (const entry of entries(selector)) { discardShopQuery(cache, entry) }
  }
  /** After a committed command, discard older requests but keep visible snapshots. */
  function invalidate(selector?: ShopQuerySelector) { for (const entry of entries(selector)) cache.invalidate(entry) }
  /** A user refresh must not cancel sibling requests sharing the transport cache. */
  function markStale(selector?: ShopQuerySelector) { for (const entry of entries(selector)) entry.when = 0 }
  return { cache, scope, scopeKey, entries, refresh, clear, invalidate, markStale }
}

/** Capture inside setup; its returned commands remain usable after await. */
export function useShopInvalidation() {
  const queries = useShopQueryCache()
  return { refreshShopQueries: queries.refresh, clearShopQueries: queries.clear }
}
