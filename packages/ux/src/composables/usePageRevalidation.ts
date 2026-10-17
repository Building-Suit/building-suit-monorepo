import { onMounted, onBeforeUnmount } from 'vue'

/** Refresh an owning view on foreground return and a visible-page interval. */
export function usePageRevalidation(work: () => unknown | Promise<unknown>, enabled: () => boolean, intervalMs = 30000) {
  let mounted = false
  let suspended = false
  let queued = false
  let flight: Promise<unknown> | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  const active = () => mounted && !suspended && enabled() && document.visibilityState==='visible'
  function refresh(): Promise<unknown> {
    if (!active()) return Promise.resolve(undefined)
    if (flight) { queued = true; return flight }
    flight = Promise.resolve().then(async () => {
      do {
        queued = false
        if (!active()) return
        try { await work() } catch { /* A later foreground return may retry. */ }
      } while (queued)
    }).finally(() => {
      flight = null
      // Vue/auth watchers can enqueue a revision between the last work result
      // and this finalizer. Its callers still wait for the newest request.
      if (queued && active()) return refresh()
    })
    return flight
  }
  function suspend() { suspended = true }
  function foreground() { void refresh() }
  onMounted(() => {
    mounted = true
    window.addEventListener('focus',foreground)
    window.addEventListener('pagehide',suspend)
    document.addEventListener('visibilitychange',foreground)
    timer = setInterval(foreground,Math.max(5000,intervalMs))
  })
  onBeforeUnmount(() => {
    mounted = false; queued = false
    if (timer!==undefined) clearInterval(timer)
    window.removeEventListener('focus',foreground)
    window.removeEventListener('pagehide',suspend)
    document.removeEventListener('visibilitychange',foreground)
  })
  return { refresh }
}
