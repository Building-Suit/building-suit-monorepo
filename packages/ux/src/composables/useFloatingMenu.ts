import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useMenuNavigation } from './useMenuNavigation.ts'

/** Chooses a popover direction after opening and remeasures on viewport changes. */
export function useFloatingMenu(panelSelector: string) {
  const menu = useMenuNavigation(() => '', '[aria-haspopup="menu"]')
  const { open, root, panel, onKeydown } = menu
  const hydrated = ref(false)
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
    await menu.toggle()
    if (open.value) updatePosition()
  }
  function handleResize() {
    if (!open.value) return
    if (resizeTimer !== undefined) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(updatePosition, 150)
  }
  onMounted(() => { hydrated.value = true; window.addEventListener('resize', handleResize) })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimer !== undefined) clearTimeout(resizeTimer)
  })
  return { root, panel, open, hydrated, position, openMenu, closeMenu: menu.close, onKeydown }
}
