import { localized, parseRegistry, selectRegistry } from '../utils/registry'
import type { AdminSession } from '../../server/utils/authorize'

export function useAdminRegistry() {
  const route = useRoute()
  const { locale } = useI18n()
  const requestFetch = useRequestFetch()
  const identity = useNuxtData<AdminSession>('super-admin-session')
  const cacheKey = computed(() => `super-admin-registry:${identity.data.value?.authorityEnvironmentId || 'unresolved'}:${identity.data.value?.userId || 'signed-out'}`)
  // The authorized endpoint resolves identity/environment on every request.
  // Its SSR data is request-scoped and cleared before session transitions.
  const registry = useAsyncData(cacheKey, async () => parseRegistry(await requestFetch('/api/registry')), { immediate: false, dedupe: 'cancel' })
  const suits = computed(() => registry.error.value ? [] : registry.data.value?.suits || [])
  const selection = computed(() => selectRegistry({ suits: suits.value }, route.query.suit, route.query.item))
  const state = computed<'loading' | 'success' | 'empty' | 'error' | 'denied'>(() => {
    if (registry.error.value) return registry.error.value.statusCode === 403 || registry.error.value.statusCode === 401 ? 'denied' : 'error'
    // A background invalidation keeps the last authorized registry visible.
    // Pending is not an identity/binding change and must not clear module state.
    if (!registry.data.value && (registry.status.value === 'pending' || registry.status.value === 'idle')) return 'loading'
    if (selection.value.denied) return 'denied'
    if (!selection.value.suit || !selection.value.suit.items.length) return 'empty'
    return 'success'
  })
  const label = (value: Record<string, string>) => localized(value, locale.value)
  const to = (suit: string, item?: string) => ({ path: '/', query: { suit, ...(item ? { item } : {}) } })
  return { registry, suits, selection, state, label, to }
}
