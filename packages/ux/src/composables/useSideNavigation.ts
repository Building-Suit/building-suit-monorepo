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
    // The opening visibility transition can still hide the close control at
    // nextTick. Settle this panel's finite motion before transferring focus.
    const animations = (panel.value?.getAnimations?.() ?? []).filter(animation => {
      const end = animation.effect?.getComputedTiming().endTime
      return typeof end === 'number' && Number.isFinite(end)
    })
    await Promise.allSettled(animations.map(animation => animation.finished))
    if (!cancelled && open()) panel.value?.querySelector<HTMLElement>('[data-side-menu-close]')?.focus()
  })
  return { panel, isActive, onKeydown }
}
