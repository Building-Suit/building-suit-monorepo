import { nextTick } from 'vue'
export function useDocumentPrint() {
  async function print() {
    if (typeof window === 'undefined') return false
    await nextTick()
    window.print()
    return true
  }
  return { print }
}
