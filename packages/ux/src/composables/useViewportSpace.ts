import { nextTick, onMounted, onScopeDispose, ref } from 'vue'
/** Measure a panel's remaining viewport space without sharing state across SSR requests. */
export function useViewportSpace(element: () => HTMLElement | null, bottomMargin = 24, bottomBoundary?: () => HTMLElement | null) {
  const available = ref<number | null>(null)
  let observer: ResizeObserver | null = null
  let frame = 0
  let disposed = false
  function viewportBottom() {
    const boundary = bottomBoundary?.()
    return boundary?.getClientRects().length ? Math.min(window.innerHeight, boundary.getBoundingClientRect().top) : window.innerHeight
  }
  function update() {
    frame = 0
    const node = element()
    if (!node?.getClientRects().length) { available.value = null; return }
    const bottom = viewportBottom()
    available.value = Math.max(0, Math.floor(bottom - Math.max(0, node.getBoundingClientRect().top) - bottomMargin))
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update) }
  /** Reveal a selected panel before measuring its remaining usable space. */
  async function reveal() {
    const node = element()
    if (disposed || !node?.getClientRects().length) return false
    // Give the document enough scroll range before aligning a panel that was
    // compressed beneath tall preceding content. Then measure its final position.
    available.value = Math.max(0, Math.floor(viewportBottom() - bottomMargin))
    await nextTick()
    if (disposed || node !== element() || !node.getClientRects().length) return false
    node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
    if (frame) cancelAnimationFrame(frame)
    update()
    await nextTick()
    return !disposed && node === element()
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule)
    const node = element(); if (node) observer.observe(node)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    schedule()
  })
  onScopeDispose(() => {
    disposed = true
    observer?.disconnect()
    if (typeof window !== 'undefined') { window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule); if (frame) cancelAnimationFrame(frame) }
  })
  return { available, update: schedule, reveal }
}
