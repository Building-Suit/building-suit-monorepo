import { ref } from 'vue'

/** Print one shared document, excluding the surrounding workspace and modal chrome. */
export function useElementPrint(element: () => HTMLElement | null) {
  const pending = ref(false)
  async function print() {
    const source = element()
    if (!source || pending.value || typeof window === 'undefined') return false
    pending.value = true
    const frame = document.createElement('iframe')
    frame.title = source.getAttribute('aria-label') || 'Print'
    frame.style.cssText = 'position:fixed;inset:0;width:0;height:0;border:0;'
    frame.setAttribute('aria-hidden', 'true')
    document.body.append(frame)
    try {
      const target = frame.contentDocument!
      const clone = source.cloneNode(true) as HTMLElement
      const computed = getComputedStyle(source)
      for (const property of Array.from(computed)) if (property.startsWith('--')) clone.style.setProperty(property, computed.getPropertyValue(property))
      clone.style.fontFamily = computed.fontFamily
      target.open(); target.write('<!doctype html><html><head></head><body></body></html>'); target.close()
      const base = target.createElement('base'); base.href = document.baseURI; target.head.append(base)
      const ready: Promise<unknown>[] = []
      for (const stylesheet of document.querySelectorAll('style, link[rel="stylesheet"]')) {
        const copy = stylesheet.cloneNode(true) as HTMLElement
        if (copy.tagName === 'LINK') ready.push(new Promise<void>(resolve => { copy.onload = () => resolve(); copy.onerror = () => resolve() }))
        target.head.append(copy)
      }
      target.body.style.margin = '0'
      target.body.append(clone)
      await Promise.all(ready)
      await target.fonts.ready
      await Promise.all(Array.from(clone.querySelectorAll('img'), image => image.decode().catch(() => undefined)))
      // Retain the document until the browser's print lifecycle has finished.
      frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true })
      frame.contentWindow!.focus(); frame.contentWindow!.print()
      setTimeout(() => frame.remove(), 60_000)
      return true
    } catch { frame.remove(); return false }
    finally { pending.value = false }
  }
  return { pending, print }
}
