import { nextTick, shallowRef, watch, type Ref } from 'vue'
/** Shared nested-detail navigation restores scroll and keyboard position per view. */
export function useNavigationPosition(key: Ref<string>) {
 const content = shallowRef<unknown>(null)
 const heading = shallowRef<unknown>(null)
 function element(value: unknown): HTMLElement | null { if (typeof HTMLElement === 'undefined') return null; if (value instanceof HTMLElement) return value; if (value && typeof value === 'object' && '$el' in value && value.$el instanceof HTMLElement) return value.$el; return null }
 const positions = new Map<string, { scroll: number; focus: string }>()
 function remember(focus: string) { positions.set(key.value, { scroll: element(content.value)?.parentElement?.scrollTop ?? 0, focus }) }
 watch(key, async value => {
  await nextTick()
  const position = positions.get(value)
  if (position) {
   const control = Array.from(element(content.value)?.querySelectorAll<HTMLElement>('[data-nav-id]') ?? []).find(element => element.dataset.navId === position.focus)
   control?.focus({ preventScroll: true })
   if (element(content.value)?.parentElement) element(content.value)!.parentElement!.scrollTop = position.scroll
  } else element(heading.value)?.focus()
 })
 return { content, heading, remember }
}
