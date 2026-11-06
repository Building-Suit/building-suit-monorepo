import { onActivated, onDeactivated, onMounted, onScopeDispose, ref, watch } from 'vue'

/** Local display time only. Never reads application data or implies progress. */
export function useDisplayClock(enabled: () => boolean) {
  const now = ref(0)
  let mounted = false, timer: ReturnType<typeof setInterval> | undefined
  function update() {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    if (!mounted) return
    now.value = Date.now()
    if (enabled() && !document.hidden) timer = setInterval(() => { now.value = Date.now() }, 1000)
  }
  watch(enabled, update)
  onMounted(() => { mounted = true; update(); document.addEventListener('visibilitychange', update) })
  onActivated(() => { mounted = true; update() })
  onDeactivated(() => { mounted = false; update() })
  onScopeDispose(() => {
    mounted = false
    if (timer !== undefined) clearInterval(timer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update)
  })
  return now
}
