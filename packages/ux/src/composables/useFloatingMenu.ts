import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { useClickOutside } from './useClickOutside.ts'

/** Chooses a popover direction after opening and remeasures on viewport changes. */
export function useFloatingMenu(panelSelector: string) {
  const open = ref(false), hydrated = ref(false)
  const root = ref<HTMLElement | null>(null)
  const position = ref<'top' | 'bottom'>('bottom')
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  function updatePosition() {
    const element = root.value?.querySelector<HTMLElement>(panelSelector)
    if (!root.value || !element) return
    const rect = root.value.getBoundingClientRect(), height = element.offsetHeight
    const below = window.innerHeight - rect.bottom, above = rect.top
    position.value = below >= height ? 'bottom' : above >= height ? 'top' : below >= above ? 'bottom' : 'top'
  }
  async function openMenu() {
    open.value = !open.value
    if (!open.value) return
    await nextTick()
    updatePosition()
  }
  function handleResize() {
    if (!open.value) return
    if (resizeTimer !== undefined) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(updatePosition, 150)
  }
  useClickOutside(root, () => { open.value = false })
  onMounted(() => { hydrated.value = true; window.addEventListener('resize', handleResize) })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimer !== undefined) clearTimeout(resizeTimer)
  })
  return { root, open, hydrated, position, openMenu }
}
