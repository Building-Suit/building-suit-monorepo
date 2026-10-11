/** Clipboard interaction shared by diagnostics and other explicit copy actions. */
export function useClipboard() {
  async function copyText(text: string) { await navigator.clipboard.writeText(text) }
  return { copyText }
}
