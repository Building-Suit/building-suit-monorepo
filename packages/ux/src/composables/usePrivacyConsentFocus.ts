import { nextTick, watch } from 'vue'
import type { Ref } from 'vue'
export function usePrivacyConsentFocus(state: () => { prompt: boolean }, reopen: Ref<HTMLElement | null>) {
  // The dialog restores its existing trigger on Escape. Saving removes the
  // first-visit trigger, so move focus to the persistent settings control.
  watch(() => state().prompt, (prompt, wasPrompt) => {
    if (wasPrompt && !prompt) void nextTick(() => reopen.value?.querySelector('button')?.focus())
  })
}
