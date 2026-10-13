import { nextTick, ref, watch, type WatchSource } from 'vue'
import { useClickOutside } from './useClickOutside.ts'

/** Menu focus, keyboard navigation, dismissal and route transitions. */
export function useMenuNavigation(route: WatchSource<string>, triggerSelector: string) {
  const open = ref(false)
  const root = ref<HTMLElement | null>(null)
  const panel = ref<HTMLElement | null>(null)
  function close(restoreFocus = false) {
    open.value = false
    if (restoreFocus) void nextTick(() => root.value?.querySelector<HTMLElement>(triggerSelector)?.focus())
  }
  async function toggle() {
    open.value = !open.value
    if (!open.value) return
    await nextTick()
    panel.value?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')?.focus()
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    if (event.key === 'Tab') { close(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = [...(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? [])].filter(item => !item.hasAttribute('disabled'))
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    const target = event.key === 'Home' ? items[0] : event.key === 'End' ? items.at(-1)
      : event.key === 'ArrowDown' ? items[(current + 1 + items.length) % items.length] : items[(current - 1 + items.length) % items.length]
    target?.focus()
  }
  useClickOutside(root, () => close())
  watch(route, () => close())
  return { open, root, panel, close, toggle, onKeydown }
}
