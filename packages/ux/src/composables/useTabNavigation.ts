import { tabNavigationTarget } from '../tabNavigation.ts'

/** Roving focus and directional keyboard behavior for controlled tab lists. */
export function useTabNavigation(
  tabs: () => readonly { key: string; disabled?: boolean }[],
  selected: () => string,
  select: (key: string) => void,
) {
  function tabindex(key: string) {
    const enabled = tabs().filter(tab => !tab.disabled)
    const active = enabled.some(tab => tab.key === selected()) ? selected() : enabled[0]?.key
    return key === active ? 0 : -1
  }
  function onKeydown(event: KeyboardEvent, current: string) {
    const target = event.currentTarget as HTMLElement
    const direction = getComputedStyle(target).direction === 'rtl' ? 'rtl' : 'ltr'
    const key = tabNavigationTarget(tabs().filter(tab => !tab.disabled).map(tab => tab.key), current, event.key, direction)
    if (key === undefined) return
    event.preventDefault()
    select(key)
    const buttons = target.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]')
    buttons?.[tabs().findIndex(tab => tab.key === key)]?.focus()
  }
  return { tabindex, onKeydown }
}
