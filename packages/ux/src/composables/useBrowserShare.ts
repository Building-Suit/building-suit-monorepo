import { ref } from 'vue'
export type BrowserShareResult = 'shared' | 'copied' | 'aborted' | 'error' | 'unavailable' | 'pending'

/** Native sharing with clipboard fallback, duplicate prevention and cancellation handling. */
export function useBrowserShare() {
  const sharing = ref(false)
  async function share(content: { title: string; text: string }): Promise<BrowserShareResult> {
    if (sharing.value) return 'pending'
    if (typeof navigator === 'undefined') return 'unavailable'
    sharing.value = true
    try {
      if (typeof navigator.share === 'function') { await navigator.share(content); return 'shared' }
      await navigator.clipboard.writeText(content.text)
      return 'copied'
    }
    catch (error) {
      return error instanceof DOMException && error.name === 'AbortError' ? 'aborted' : 'error'
    }
    finally { sharing.value = false }
  }
  return { sharing, share }
}
