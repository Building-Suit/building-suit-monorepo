import { onMounted, onBeforeUnmount } from 'vue'

/** Refresh an owning view on foreground return and a visible-page interval. */
export function usePageRevalidation(work: () => unknown | Promise<unknown>, enabled: () => boolean, intervalMs = 30000) {
  let mounted = false
  let suspended = false
  let flight: Promise<unknown> | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  function refresh() {
    if (!mounted || suspended || !enabled() || document.visibilityState!=='visible') return Promise.resolve(undefined)
    if (flight) return flight
    flight = Promise.resolve().then(() => mounted && !suspended && enabled() && document.visibilityState==='visible' ? work() : undefined).catch(() => undefined).finally(() => { flight = null })
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
    mounted = false
    if (timer!==undefined) clearInterval(timer)
    window.removeEventListener('focus',foreground)
    window.removeEventListener('pagehide',suspend)
    document.removeEventListener('visibilitychange',foreground)
  })
  return { refresh }
}
