import type { UseQueryEntry, useQueryCache } from '@pinia/colada'
import { nextTick } from 'vue'

/** Hide old scope data immediately, then detach entries after their consumers move. */
export function discardShopQuery(cache: ReturnType<typeof useQueryCache>, entry: UseQueryEntry) {
  cache.cancel(entry)
  cache.setEntryState(entry, { status: 'pending', data: undefined, error: null })
  entry.when = 0
  if (!entry.active) cache.remove(entry)
  else void nextTick(() => { if (!entry.active) cache.remove(entry) })
}
