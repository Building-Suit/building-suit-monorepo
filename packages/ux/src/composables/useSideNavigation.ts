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
  watch(open, async (value, _previous, onCleanup) => {
    if (!value) return
    let cancelled = false
    onCleanup(() => { cancelled = true })
    await nextTick()
    const focusClose = () => {
      if (cancelled || !open()) return
      const target = panel.value?.querySelector<HTMLElement>('[data-side-menu-close]')
      // The responsive desktop close control has no box and must not be focused.
      if (!target || !target.getClientRects().length) return
      if (typeof getComputedStyle === 'function' && getComputedStyle(target).visibility !== 'visible') {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusClose)
        return
      }
      target.focus()
    }
    // A DOM update can precede CSS visibility; focus only once it is visible.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusClose)
    else focusClose()
  })
  return { panel, isActive, onKeydown }
}
