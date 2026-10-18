import { nextTick, ref, watchPostEffect } from 'vue'
// Keep native radio state consistent when a controlled change is asynchronous
// or declined. Restore both the attempted radio and its unchecked sibling.
export function useControlledRadioGroup(value: () => string, commit: (next: string) => void) {
  const root = ref<HTMLElement | null>(null)
  function synchronize() {
    const selected = value()
    root.value?.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(input => { input.checked = input.value === selected })
  }
  watchPostEffect(synchronize)
  function choose(next: string) { commit(next); void nextTick(synchronize) }
  return { root, choose }
}
