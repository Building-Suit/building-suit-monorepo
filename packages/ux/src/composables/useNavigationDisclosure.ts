import { nextTick, ref, watch, type WatchSource } from 'vue'

/** In-flow navigation disclosure. No modal semantics or focus trap. */
export function useNavigationDisclosure(reset?: WatchSource<unknown>) {
  const open = ref(false)
  const trigger = ref<HTMLElement | null>(null)
  async function close(restoreFocus = false) {
    open.value = false
    if (restoreFocus) {
      await nextTick()
      trigger.value?.focus()
    }
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open.value) return
    event.preventDefault()
    void close(true)
  }
  if (reset) watch(reset, () => { void close() })
  return { open, trigger, close, onKeydown }
}
