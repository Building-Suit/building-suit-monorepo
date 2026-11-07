import { nextTick, type Ref } from 'vue'

/** Focuses a native control or the accessible control exposed by a wrapped widget. */
export function useControlFocus(native: Ref<HTMLElement | null>, component: Ref<unknown>) {
  function focus() {
    if (native.value) { native.value.focus(); return }
    const widget = component.value as { $el?: HTMLElement } | null
    const root = widget?.$el
    const control = root?.querySelector<HTMLElement>('[role="combobox"]') ?? root
    control?.focus()
  }
  async function preserveDuring<T>(work: () => Promise<T>): Promise<T> {
    const control = native.value
    const focused = Boolean(control && document.activeElement === control)
    try { return await work() }
    finally {
      await nextTick()
      // A pending native button blurs when disabled. Restore its focus only
      // when the user has not moved to another control during the operation.
      if (focused && control && control === native.value && control.isConnected
        && (document.activeElement === document.body || document.activeElement === control)) control.focus()
    }
  }
  return { focus, preserveDuring }
}
