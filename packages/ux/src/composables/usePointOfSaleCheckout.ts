import { nextTick, ref, watch } from 'vue'

/** Two-stage counter presentation; authorization and payment stay with the product. */
export function usePointOfSaleCheckout(empty: () => boolean, blocked: () => boolean, focus: () => void) {
  const step = ref<1 | 2>(1)
  async function select(value: 1 | 2) {
    if (blocked() || value === 2 && empty()) return
    step.value = value
    await nextTick()
    focus()
  }
  watch(empty, value => { if (value) step.value = 1 })
  return { step, select }
}
