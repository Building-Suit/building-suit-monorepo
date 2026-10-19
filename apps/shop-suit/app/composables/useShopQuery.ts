import { useQuery } from '@pinia/colada'
import { computed, ref, toValue, onMounted, getCurrentInstance, type MaybeRefOrGetter, type WatchSource } from 'vue'
import { useShopQueryCache, type ShopQueryScope } from './useShopQueryCache'

interface ShopQueryOptions<T> {
  default?: () => T
  watch?: readonly (WatchSource<unknown> | object)[] | false
  server?: boolean
  immediate?: boolean
  scope?: ShopQueryScope
  staleTime?: number
  enabled?: MaybeRefOrGetter<boolean>
}

/** Product queries share Colada’s cache and expose typed feature projections. */
export function useShopQuery<T>(resource: MaybeRefOrGetter<string>, load: () => Promise<T>, options: ShopQueryOptions<T> & { default: () => T }): ReturnType<typeof createShopQuery<T, T>>
export function useShopQuery<T>(resource: MaybeRefOrGetter<string>, load: () => Promise<T>, options?: ShopQueryOptions<T>): ReturnType<typeof createShopQuery<T, T | undefined>>
export function useShopQuery<T>(resource: MaybeRefOrGetter<string>, load: () => Promise<T>, options: ShopQueryOptions<T> = {}) { return createShopQuery<T, T | undefined>(resource, load, options) }

function createShopQuery<T, D>(resource: MaybeRefOrGetter<string>, load: () => Promise<T>, options: ShopQueryOptions<T>) {
  const queries = useShopQueryCache()
  const { cache, scopeKey } = queries
  const instance = getCurrentInstance()
  const mounted = ref(import.meta.client && !instance)
  const app = useNuxtApp()
  const key = computed(() => [...scopeKey(options.scope ?? (toValue(resource).startsWith('platform-admin:') ? 'account' : 'location')), toValue(resource), JSON.stringify(options.watch ? options.watch.map(source => toValue(source)) : [])])
  const enabled = computed(() => options.immediate !== false && toValue(options.enabled ?? true) && (options.server !== false || mounted.value))
  const query = useQuery<T>({
    key, enabled, query: () => app.runWithContext(load), staleTime: options.staleTime ?? 30_000,
    meta: () => ({ shopResource: toValue(resource) }),
  })
  if (instance) onMounted(() => { mounted.value = true })
  const fallback = options.default?.()
  const data = computed<T | D>({ get: () => (query.data.value === undefined ? fallback : query.data.value) as T | D, set: value => cache.setQueryData(key.value, value) })
  // Initial loading and background revalidation are deliberately separate.
  const pending = computed(() => enabled.value && query.isPending.value)
  const status = computed(() => !enabled.value && query.isPending.value ? 'idle' : query.isPending.value ? 'pending' : query.error.value ? 'error' : 'success')
  async function refresh(_options?: unknown) {
    const entry = cache.get(key.value)
    if (entry && !entry.pending) entry.when = 0
    queries.markStale(resource => resource.startsWith('rpc:') || resource.startsWith('table:'))
    await query.refresh()
  }
  function clear() {
    const entry = cache.get(key.value)
    if (entry) {
      cache.cancel(entry)
      cache.setEntryState(entry, { status: 'pending', data: undefined, error: null })
      entry.when = 0
    }
  }
  const ensure = () => query.refresh().then(() => undefined)
  return { data, pending, isLoading: query.isLoading, error: query.error, status, refresh, execute: refresh, ensure, clear }
}
