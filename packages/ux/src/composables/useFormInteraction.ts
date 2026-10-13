import { nextTick, ref, watch } from 'vue'

/** Pending submit exclusion and error-summary focus belong to shared interaction policy. */
export function useFormInteraction(state: { readonly pending: boolean; readonly error?: string | null }, submitIntent: (event: Event) => void) {
  const summary = ref<HTMLElement | null>(null)
  watch(() => state.error, async error => {
    if (error) { await nextTick(); summary.value?.focus() }
  })
  async function submit(event: Event) {
    if (state.pending) return
    submitIntent(event)
    await nextTick()
    if (state.error) summary.value?.focus()
  }
  return { summary, submit }
}
