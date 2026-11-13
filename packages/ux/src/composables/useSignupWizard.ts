/** Each app supplies its steps and validation; navigation and pending state are shared. */
import { ref, computed } from 'vue'
export function useSignupWizard(totalSteps: number) {
  if (!Number.isInteger(totalSteps) || totalSteps < 1) throw new Error('A wizard needs at least one step')
  const step = ref(1)
  const advancing = ref(false)
  const isLastStep = computed(() => step.value === totalSteps)
  let generation = 0
  async function advance(validate: () => boolean | Promise<boolean> = () => true) {
    if (advancing.value || isLastStep.value) return false
    advancing.value = true
    const captured = generation
    try { if (!await validate() || captured !== generation) return false; step.value += 1; return true }
    finally { if (captured === generation) advancing.value = false }
  }
  function back() { if (!advancing.value) step.value = Math.max(1, step.value - 1) }
  function reset() { generation++; step.value = 1; advancing.value = false }
  return { step, advancing, isLastStep, advance, back, reset }
}

/** Initial step focus must never interrupt a user already editing that step. */
export function focusSignupStage(element: Element) {
  const active = element.ownerDocument.activeElement
  if (active && element.contains(active)) return
  const control = element.querySelector<HTMLElement>('input:not([readonly]):not([disabled]),select:not([disabled]),button:not([disabled])')
  control?.focus({ preventScroll: true })
}
