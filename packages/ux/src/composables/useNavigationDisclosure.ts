import { nextTick, ref } from 'vue'

/** In-flow navigation disclosure. No modal semantics or focus trap. */
export function useNavigationDisclosure() {
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
  return { open, trigger, close, onKeydown }
}
