import { nextTick, ref, watch } from 'vue'
export function useSideNavigation(open: () => boolean, path: () => string, close: () => void) {
  const panel = ref<HTMLElement | null>(null)
  function isActive(to: string) { return path() === to || path().startsWith(`${to}/`) }
  function onKeydown(event: KeyboardEvent) {
    if (!open()) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const focusable = [...(panel.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])].filter(element => !element.hasAttribute('hidden') && element.getClientRects().length > 0)
    const first = focusable[0], last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  watch(open, async value => {
    if (!value) return
    await nextTick()
    panel.value?.querySelector<HTMLElement>('[data-side-menu-close]')?.focus()
  })
  return { panel, isActive, onKeydown }
}
