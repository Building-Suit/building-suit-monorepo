/** Each app supplies its steps and validation; navigation and pending state are shared. */
export function useSignupWizard(totalSteps: number) {
  if (!Number.isInteger(totalSteps) || totalSteps < 1) throw new Error('A wizard needs at least one step')
  const step = ref(1)
  const advancing = ref(false)
  const isLastStep = computed(() => step.value === totalSteps)
  async function advance(validate: () => boolean | Promise<boolean> = () => true) {
    if (advancing.value || isLastStep.value) return false
    advancing.value = true
    try { if (!await validate()) return false; step.value += 1; return true }
    finally { advancing.value = false }
  }
  function back() { if (!advancing.value) step.value = Math.max(1, step.value - 1) }
  function reset() { step.value = 1 }
  return { step, advancing, isLastStep, advance, back, reset }
}
