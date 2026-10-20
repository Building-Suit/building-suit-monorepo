import { computed } from 'vue'
import { useShopPreferencesStore } from '~/stores/preferences'

export function useShopState<T>(key: string, initialize: () => T) {
  const store = useShopPreferencesStore()
  if (!Object.hasOwn(store.values, key)) store.values[key] = initialize()
  return computed<T>({ get: () => store.values[key] as T, set: value => { store.values[key] = value } })
}
