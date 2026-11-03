import { computed, onScopeDispose, ref } from 'vue'

/** Presentation-only pan/zoom. Owns no application records or authorization. */
export function useOfficeViewport() {
  const element = ref<HTMLElement | null>(null)
  const scale = ref(1)
  const x = ref(0), y = ref(0), dragging = ref(false)
  let pointer: number | null = null
  let origin = { pointerX: 0, pointerY: 0, x: 0, y: 0 }
  const clamp = (value: number, max: number) => Math.max(-max, Math.min(max, value))
  function bound() {
    const width = element.value?.clientWidth ?? 0
    const height = element.value?.clientHeight ?? 0
    x.value = clamp(x.value, width * (scale.value - 1) / 2)
    y.value = clamp(y.value, height * (scale.value - 1) / 2)
  }
  function zoom(delta: number) {
    scale.value = Math.max(1, Math.min(2.4, Math.round((scale.value + delta) * 10) / 10))
    bound()
  }
  function reset() { scale.value = 1; x.value = 0; y.value = 0 }
  function onKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return
    const arrows: Record<string, [number, number]> = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] }
    if (event.key === '+' || event.key === '=') zoom(.2)
    else if (event.key === '-') zoom(-.2)
    else if (event.key === '0' || event.key === 'Home') reset()
    else if (arrows[event.key] && scale.value > 1) { x.value += arrows[event.key]![0]; y.value += arrows[event.key]![1]; bound() }
    else return
    event.preventDefault()
  }
  function onPointerDown(event: PointerEvent) {
    if (scale.value <= 1 || event.button !== 0 || (event.target as Element | null)?.closest('button,a,input,textarea,select')) return
    const target = event.currentTarget as HTMLElement
    origin = { pointerX: event.clientX, pointerY: event.clientY, x: x.value, y: y.value }
    pointer = event.pointerId
    dragging.value = true
    target.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging.value || event.pointerId !== pointer) return
    x.value = origin.x + event.clientX - origin.pointerX
    y.value = origin.y + event.clientY - origin.pointerY
    bound()
  }
  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    const target = event.currentTarget as HTMLElement
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
    pointer = null; dragging.value = false
  }
  function centerOn(normalizedX: number, normalizedY: number) {
    const width = element.value?.clientWidth ?? 0, height = element.value?.clientHeight ?? 0
    x.value = (.5 - normalizedX) * width * scale.value
    y.value = (.5 - normalizedY) * height * scale.value
    bound()
  }
  function onMiniMapClick(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    centerOn((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
  }
  onScopeDispose(() => { pointer = null; dragging.value = false })
  const transform = computed(() => ({ transform: 'translate(' + x.value + 'px,' + y.value + 'px) scale(' + scale.value + ')' }))
  return { element, scale, dragging, transform, zoom, reset, bound, onKeydown, onPointerDown, onPointerMove, onPointerEnd, centerOn, onMiniMapClick }
}
