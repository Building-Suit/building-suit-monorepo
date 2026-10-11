import type { Ref } from 'vue'

/** Focuses a native control or the accessible control exposed by a wrapped widget. */
export function useControlFocus(native: Ref<HTMLElement | null>, component: Ref<unknown>) {
  function focus() {
    if (native.value) { native.value.focus(); return }
    const widget = component.value as { $el?: HTMLElement } | null
    const root = widget?.$el
    const control = root?.querySelector<HTMLElement>('[role="combobox"]') ?? root
    control?.focus()
  }
  return { focus }
}
