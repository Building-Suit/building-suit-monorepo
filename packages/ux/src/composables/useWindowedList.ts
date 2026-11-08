import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

/** Fixed-height, lazy window. Replaces old rows instead of retaining task history. */
export function useWindowedList<T>(options: {
  key: () => string
  enabled: () => boolean
  size: () => number
  rowHeight: number
  load: (offset: number, limit: number, signal: AbortSignal) => Promise<{ items: readonly T[]; total: number }>
}) {
  const items = shallowRef<readonly T[]>([])
  const total = ref(0), offset = ref(0), pending = ref(false), failed = ref(false)
  let request: AbortController | null = null, epoch = 0
  async function load(start = 0) {
    request?.abort()
    const version = ++epoch
    if (!options.enabled()) { items.value = []; total.value = 0; offset.value = 0; pending.value = false; failed.value = false; return }
    request = new AbortController()
    pending.value = true; failed.value = false
    // Drop the previous window immediately so a scrolled viewport never opens
    // a stale task at the new offset while the next request is in flight.
    items.value = []; offset.value = start
    try {
      const result = await options.load(start, options.size(), request.signal)
      if (version !== epoch) return
      total.value = result.total
      if (start >= result.total && start > 0) {
        await load(Math.max(0, Math.floor((result.total - 1) / options.size()) * options.size()))
        return
      }
      items.value = result.items
    } catch {
      if (version === epoch) failed.value = true
    } finally { if (version === epoch) pending.value = false }
  }
  function scroll(top: number) {
    const start = Math.floor(Math.max(0, top) / options.rowHeight)
    if (start !== offset.value && start < total.value) void load(start)
  }
  watch(() => [options.key(), options.enabled(), options.size()], () => {
    total.value = 0; void load()
  }, { immediate: true })
  onScopeDispose(() => { ++epoch; request?.abort(); items.value = [] })
  return { items, total, offset, pending, failed, scroll, reload: () => load(offset.value),
    before: computed(() => offset.value * options.rowHeight),
    after: computed(() => Math.max(0, total.value - offset.value - items.value.length) * options.rowHeight) }
}
