import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

/** A free canvas transform. Pan offsets are independent of native scrolling. */
export function usePanZoomViewport(getSize: () => { width: number; height: number }, enabled: () => boolean) {
  const viewport = shallowRef<HTMLElement | null>(null)
  const dimensions = shallowRef({ width: 0, height: 0 })
  const scale = ref(1)
  const pan = shallowRef({ x: 0, y: 0 })
  const dragging = ref(false)
  let observer: ResizeObserver | undefined
  let suppressClick = false
  let fitted = true
  let gesture: { id: number; clientX: number; clientY: number; x: number; y: number } | null = null

  const fitScale = computed(() => {
    const size = getSize()
    const { width, height } = dimensions.value
    return width && height ? Math.min(1, Math.max(1, width - 32) / size.width, Math.max(1, height - 32) / size.height) : 1
  })
  const min = computed(() => Math.min(.25, fitScale.value))
  const max = 2.5
  function fit() { fitted = true; scale.value = fitScale.value; pan.value = { x: 0, y: 0 } }
  function reset() { fitted = false; scale.value = 1; pan.value = { x: 0, y: 0 } }
  watch(fitScale, () => { if (fitted) fit() })
  watch([viewport, enabled], ([element, ready]) => {
    observer?.disconnect()
    if (!element || !ready) return
    const measure = () => { dimensions.value = { width: element.clientWidth, height: element.clientHeight } }
    measure()
    fit()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(element)
    }
  }, { immediate: true, flush: 'post' })

  function zoomBy(factor: number, pointer?: { clientX: number; clientY: number }) {
    const element = viewport.value
    if (!element || !enabled()) return
    const next = Math.min(max, Math.max(min.value, scale.value * factor))
    if (next === scale.value) return
    const rect = element.getBoundingClientRect()
    const x = pointer ? pointer.clientX - rect.left - rect.width / 2 : 0
    const y = pointer ? pointer.clientY - rect.top - rect.height / 2 : 0
    const ratio = next / scale.value
    pan.value = { x: x + (pan.value.x - x) * ratio, y: y + (pan.value.y - y) * ratio }
    fitted = false
    scale.value = next
  }
  function onPointerDown(event: PointerEvent) {
    if (!enabled() || !event.isPrimary || event.button !== 0) return
    suppressClick = false
    gesture = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...pan.value }
  }
  function onPointerMove(event: PointerEvent) {
    const element = viewport.value
    if (!element || gesture?.id !== event.pointerId) return
    const x = event.clientX - gesture.clientX, y = event.clientY - gesture.clientY
    if (!dragging.value && Math.hypot(x, y) < 5) return
    if (!dragging.value) {
      dragging.value = true
      suppressClick = true
      element.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    fitted = false
    pan.value = { x: gesture.x + x, y: gesture.y + y }
  }
  function onPointerEnd(event: PointerEvent) {
    if (gesture?.id !== event.pointerId) return
    gesture = null
    dragging.value = false
  }
  function onPointerLeave(event: PointerEvent) { if (!dragging.value) onPointerEnd(event) }
  function onLostPointerCapture(event: PointerEvent) { if (event.target === viewport.value) onPointerEnd(event) }
  function onClick(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }
  function onWheel(event: WheelEvent) {
    if (!enabled() || !event.deltaY) return
    event.preventDefault()
    zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event)
  }
  function onKeydown(event: KeyboardEvent) {
    if (!enabled() || event.target !== viewport.value || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === '+' || event.key === '=') zoomBy(1.2)
    else if (event.key === '-') zoomBy(1 / 1.2)
    else if (event.key === '0') fit()
    else if (event.key === 'Home') reset()
    else {
      const offsets: Record<string, [number, number]> = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] }
      const offset = offsets[event.key]
      if (!offset) return
      fitted = false
      pan.value = { x: pan.value.x + offset[0], y: pan.value.y + offset[1] }
    }
    event.preventDefault()
    event.stopPropagation()
  }
  function onFocusIn(event: FocusEvent) {
    const target = event.target, element = viewport.value
    if (!(target instanceof HTMLElement) || !element || target === element || !target.matches(':focus-visible') || !enabled()) return
    const view = element.getBoundingClientRect(), item = target.getBoundingClientRect()
    const x = item.left < view.left + 12 ? view.left + 12 - item.left : Math.min(0, view.right - 12 - item.right)
    const y = item.top < view.top + 12 ? view.top + 12 - item.top : Math.min(0, view.bottom - 12 - item.bottom)
    if (x || y) { fitted = false; pan.value = { x: pan.value.x + x, y: pan.value.y + y } }
  }
  onScopeDispose(() => observer?.disconnect())
  return { viewport, pan, scale, dragging, fit, reset, zoomBy,
    canZoomIn: computed(() => scale.value < max), canZoomOut: computed(() => scale.value > min.value),
    onPointerDown, onPointerMove, onPointerEnd, onPointerLeave, onLostPointerCapture, onClick, onWheel, onKeydown, onFocusIn }
}
