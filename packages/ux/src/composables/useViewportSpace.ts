import { onMounted, onScopeDispose, ref } from 'vue'
/** Measure a panel's remaining viewport space without sharing state across SSR requests. */
export function useViewportSpace(element: () => HTMLElement | null, bottomMargin = 24, bottomBoundary?: () => HTMLElement | null) {
  const available = ref<number | null>(null)
  let observer: ResizeObserver | null = null
  let frame = 0
  function update() {
    frame = 0
    const node = element()
    if (!node?.getClientRects().length) { available.value = null; return }
    const boundary = bottomBoundary?.()
    const bottom = boundary?.getClientRects().length ? Math.min(window.innerHeight, boundary.getBoundingClientRect().top) : window.innerHeight
    available.value = Math.max(0, Math.floor(bottom - Math.max(0, node.getBoundingClientRect().top) - bottomMargin))
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update) }
  onMounted(() => {
    observer = new ResizeObserver(schedule)
    const node = element(); if (node) observer.observe(node)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    schedule()
  })
  onScopeDispose(() => {
    observer?.disconnect()
    if (typeof window !== 'undefined') { window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule); if (frame) cancelAnimationFrame(frame) }
  })
  return { available, update: schedule }
}
