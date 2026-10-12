import { ref } from 'vue'

/** Shared disclosure state for informational overlays with no domain writes. */
export function useOverlayState() {
  const open = ref(false)
  const show = () => { open.value = true }
  const close = () => { open.value = false }
  return { open, show, close }
}
