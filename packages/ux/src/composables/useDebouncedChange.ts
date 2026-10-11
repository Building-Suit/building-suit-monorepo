import { onScopeDispose, watch, type WatchSource } from 'vue'

/** Coalesces interaction changes, cancelling pending work when the view is disposed. */
export function useDebouncedChange<T>(source: WatchSource<T>, commit: (value: T) => void, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const stop = watch(source, (value) => {
    cancel()
    timer = setTimeout(() => { timer = undefined; commit(value) }, delay)
  })
  onScopeDispose(() => { cancel(); stop() })
  return { cancel }
}
