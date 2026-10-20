import { nextTick, watch } from 'vue'
import type { Ref } from 'vue'
export function usePrivacyConsentFocus(state: () => { prompt: boolean }, reopen: Ref<HTMLElement | null>) {
  watch(() => state().prompt, (prompt, wasPrompt) => {
    if (!wasPrompt || prompt) return
    void nextTick(() => {
      const control = reopen.value?.querySelector('button')
      if (control) { control.focus(); return }
      // Some products deliberately offer settings on their privacy page rather
      // than a persistent floating button. Keep focus on the current page.
      const content = globalThis.document?.querySelector<HTMLElement>('main h1, main, h1')
      if (!content) return
      const previous = content.getAttribute('tabindex')
      content.setAttribute('tabindex', '-1'); content.focus()
      content.addEventListener('blur', () => { if (previous === null) content.removeAttribute('tabindex'); else content.setAttribute('tabindex', previous) }, { once: true })
    })
  })
}
