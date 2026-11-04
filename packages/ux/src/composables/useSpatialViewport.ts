import { computed, onMounted, onScopeDispose, reactive, readonly, ref, shallowRef } from 'vue'

export interface SpatialViewportCamera {
  yaw: number
  pitch: number
  zoom: number
  /** Camera-plane offsets in world units, measured from the scene's origin. */
  panX: number
  panY: number
}

interface SpatialPointer {
  x: number
  y: number
  startX: number
  startY: number
  activationEligible: boolean
  touch: boolean
  pan: boolean
  capture: HTMLElement
}

interface TouchGesture {
  x: number
  y: number
  distance: number
}

export const SPATIAL_VIEWPORT_DEFAULT_CAMERA: Readonly<SpatialViewportCamera> = Object.freeze({ yaw: 0.55, pitch: 0.5, zoom: 1, panX: 0, panY: 0 })
export const SPATIAL_VIEWPORT_MIN_ZOOM = 0.35
export const SPATIAL_VIEWPORT_MAX_ZOOM = 3.5
const maximumPitch = Math.PI / 2 - 0.08
const interactiveSelector = 'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-spatial-controls]'

/** Request-scoped orbit, pan and zoom mechanics for a shared spatial viewport. */
export function useSpatialViewport(onActivate?: (clientX: number, clientY: number) => void) {
  const viewportRef = shallowRef<HTMLElement | null>(null)
  const camera = reactive<SpatialViewportCamera>({ ...SPATIAL_VIEWPORT_DEFAULT_CAMERA })
  const pointerCount = ref(0)
  const resetVersion = ref(0)
  const pointers = new Map<number, SpatialPointer>()
  let touchGesture: TouchGesture | null = null

  function ignoresTarget(target: EventTarget | null) {
    return typeof Element !== 'undefined' && target instanceof Element && Boolean(target.closest(interactiveSelector))
  }

  function zoomBy(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) return
    camera.zoom = Math.max(SPATIAL_VIEWPORT_MIN_ZOOM, Math.min(SPATIAL_VIEWPORT_MAX_ZOOM, camera.zoom * factor))
  }

  function orbit(x: number, y: number) {
    camera.yaw = ((camera.yaw - x * 0.007) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    camera.pitch = Math.max(-maximumPitch, Math.min(maximumPitch, camera.pitch + y * 0.007))
  }

  function pan(x: number, y: number) {
    const bounds = viewportRef.value?.getBoundingClientRect()
    const height = Math.max(1, bounds?.height ?? 600)
    const aspect = Math.max(1, bounds?.width ?? 800) / height
    const fit = Math.max(1, 0.76 / aspect)
    const scale = 7 * fit / height / camera.zoom
    camera.panX -= x * scale
    camera.panY += y * scale
  }

  function currentTouchGesture(): TouchGesture | null {
    const touches = [...pointers.values()].filter(pointer => pointer.touch)
    const first = touches[0]
    const second = touches[1]
    if (!first || !second) return null
    return {
      x: touches.reduce((sum, pointer) => sum + pointer.x, 0) / touches.length,
      y: touches.reduce((sum, pointer) => sum + pointer.y, 0) / touches.length,
      distance: Math.hypot(second.x - first.x, second.y - first.y),
    }
  }

  function releasePointer(id: number, pointer: SpatialPointer) {
    // An element can be removed or lose capture before pointerup reaches it.
    try {
      if (pointer.capture.hasPointerCapture(id)) pointer.capture.releasePointerCapture(id)
    }
    catch { /* Capture has already ended with the element's lifecycle. */ }
  }

  function endInteraction() {
    const active = [...pointers.entries()]
    pointers.clear()
    pointerCount.value = 0
    touchGesture = null
    for (const [id, pointer] of active) releasePointer(id, pointer)
  }

  function reset() {
    endInteraction()
    Object.assign(camera, SPATIAL_VIEWPORT_DEFAULT_CAMERA)
    resetVersion.value++
  }

  function onPointerDown(event: PointerEvent) {
    if (ignoresTarget(event.target) || (event.pointerType !== 'touch' && ![0, 1, 2].includes(event.button))) return
    const element = viewportRef.value
    if (!element) return
    event.preventDefault()
    element.focus({ preventScroll: true })
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      activationEligible: event.isPrimary && event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey,
      touch: event.pointerType === 'touch',
      pan: event.shiftKey || event.button === 1 || event.button === 2,
      capture: element,
    })
    if (pointers.size > 1) for (const pointer of pointers.values()) pointer.activationEligible = false
    pointerCount.value = pointers.size
    touchGesture = currentTouchGesture()
    try { element.setPointerCapture(event.pointerId) }
    catch { /* A cancelled pointer may no longer be available for capture. */ }
  }

  function onPointerMove(event: PointerEvent) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    event.preventDefault()
    if (!pointer.touch && event.buttons === 0) { onPointerEnd(event); return }
    const x = event.clientX - pointer.x
    const y = event.clientY - pointer.y
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 6 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) pointer.activationEligible = false
    pointer.x = event.clientX
    pointer.y = event.clientY
    const nextGesture = currentTouchGesture()
    if (pointer.touch && nextGesture) {
      if (touchGesture) {
        if (touchGesture.distance > 0 && nextGesture.distance > 0) zoomBy(nextGesture.distance / touchGesture.distance)
        pan(nextGesture.x - touchGesture.x, nextGesture.y - touchGesture.y)
      }
      touchGesture = nextGesture
    }
    else if (pointer.pan || event.shiftKey) pan(x, y)
    else orbit(x, y)
  }

  function onPointerEnd(event: PointerEvent) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    const activate = event.type === 'pointerup' && pointer.activationEligible && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 6
    pointers.delete(event.pointerId)
    pointerCount.value = pointers.size
    touchGesture = currentTouchGesture()
    releasePointer(event.pointerId, pointer)
    if (activate) onActivate?.(event.clientX, event.clientY)
  }

  function onWheel(event: WheelEvent) {
    if (ignoresTarget(event.target)) return
    event.preventDefault()
    for (const pointer of pointers.values()) pointer.activationEligible = false
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (viewportRef.value?.clientHeight ?? 600) : 1
    const delta = Math.max(-160, Math.min(160, event.deltaY * unit))
    zoomBy(Math.exp(-delta * 0.0015))
  }

  function onKeydown(event: KeyboardEvent) {
    if (ignoresTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
    switch (event.key) {
      case 'ArrowLeft': event.shiftKey ? pan(-28, 0) : orbit(-12, 0); break
      case 'ArrowRight': event.shiftKey ? pan(28, 0) : orbit(12, 0); break
      case 'ArrowUp': event.shiftKey ? pan(0, -28) : orbit(0, -12); break
      case 'ArrowDown': event.shiftKey ? pan(0, 28) : orbit(0, 12); break
      case '+': case '=': zoomBy(1.15); break
      case '-': case '_': zoomBy(1 / 1.15); break
      case 'Home': case '0': reset(); break
      default: return
    }
    event.preventDefault()
  }

  function onVisibilityChange() {
    if (document.hidden) endInteraction()
  }

  onMounted(() => {
    window.addEventListener('blur', endInteraction)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onScopeDispose(() => {
    endInteraction()
    if (typeof window === 'undefined') return
    window.removeEventListener('blur', endInteraction)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    viewportRef,
    camera: readonly(camera),
    resetVersion: readonly(resetVersion),
    isInteracting: computed(() => pointerCount.value > 0),
    zoomPercent: computed(() => Math.round(camera.zoom * 100)),
    canZoomIn: computed(() => camera.zoom < SPATIAL_VIEWPORT_MAX_ZOOM),
    canZoomOut: computed(() => camera.zoom > SPATIAL_VIEWPORT_MIN_ZOOM),
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onWheel,
    onKeydown,
    zoomBy,
    reset,
  }
}
