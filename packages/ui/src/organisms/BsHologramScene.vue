<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { SpatialViewportCamera } from '@building-suit/ux'
import { createHologramRenderer } from '../utils/hologramScene'
import type { HologramPalette, HologramRenderer } from '../utils/hologramScene'

const props = withDefaults(defineProps<{ camera: Readonly<SpatialViewportCamera>; resetVersion: number; label: string; unavailableLabel: string; opened?: boolean }>(), { opened: false })
const emit = defineEmits<{ activate: [] }>()
const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
const unavailable = ref(false)
let renderer: HologramRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let motion: MediaQueryList | null = null
let frame = 0, visible = true, elapsed = 0, lastFrame = 0, disposed = false
let lastPaint = 0, needsDraw = true
let openAmount = props.opened ? 1 : 0, excitedAmount = 0, excitedTarget = 0

function activateAt(clientX: number, clientY: number) {
  if (disposed || unavailable.value || !visible || !renderer?.hitTestOrb(clientX, clientY)) return false
  emit('activate')
  return true
}
function setExcitedAt(clientX: number, clientY: number, active: boolean) {
  const hit = active && !disposed && !unavailable.value && visible && Boolean(renderer?.hitTestOrb(clientX, clientY))
  const nextTarget = hit && !props.opened && openAmount < 0.001 ? 1 : 0
  if (nextTarget !== excitedTarget) {
    excitedTarget = nextTarget
    if (props.opened || openAmount > 0.001) excitedAmount = 0
    if (typeof window !== 'undefined') requestDraw()
  }
  return hit
}
defineExpose({ activateAt, setExcitedAt })

function requestDraw(force = true) {
  if (force) needsDraw = true
  if (!disposed && !frame && visible && !document.hidden && renderer) frame = requestAnimationFrame(draw)
}
function draw(time: number) {
  frame = 0
  if (!renderer || !visible || document.hidden) return
  const reduced = motion?.matches ?? false
  const openTarget = props.opened ? 1 : 0
  const transitioning = Math.abs(openTarget - openAmount) > 0.001
  const minimumFrame = transitioning || excitedTarget ? 1000 / 60 : 1000 / 30
  if (!reduced && !needsDraw && lastPaint && time - lastPaint + 0.5 < minimumFrame) {
    requestDraw(false)
    return
  }
  needsDraw = false; lastPaint = time
  const delta = lastFrame ? Math.min(0.064, Math.max(0, (time - lastFrame) / 1000)) : 0
  lastFrame = time
  if (!reduced) elapsed += delta
  openAmount = reduced ? openTarget : openAmount + (openTarget - openAmount) * (1 - Math.exp(-delta * 7))
  if (props.opened || openAmount > 0.001) { excitedTarget = 0; excitedAmount = 0 }
  else excitedAmount = reduced ? 0 : excitedAmount + (excitedTarget - excitedAmount) * (1 - Math.exp(-delta * 12))
  renderer.draw(props.camera, reduced ? 0 : elapsed, { open: openAmount, excited: excitedAmount, opened: props.opened })
  if (!motion?.matches) requestDraw(false)
}
function updateVisibility() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  lastFrame = 0; lastPaint = 0
  requestDraw()
}
function startRenderer() {
  const canvas = canvasRef.value
  if (!canvas) return
  renderer?.dispose()
  const style = getComputedStyle(canvas)
  const read = (token: string): [number, number, number] => {
    const hex = style.getPropertyValue(token).trim().replace('#', '')
    return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number]
  }
  const palette: HologramPalette = {
    navy: read('--bs-color-brand-building-navy'), surface: read('--bs-color-brand-navy-surface'),
    gold: read('--bs-color-brand-premium-gold'), steel: read('--bs-color-secondary-sky-steel'),
    light: read('--bs-color-secondary-pale-sky'), pearl: read('--bs-color-brand-pearl-white'),
  }
  renderer = createHologramRenderer(canvas, palette)
  unavailable.value = !renderer
  requestDraw()
}
function onContextLost(event: Event) {
  event.preventDefault()
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  renderer?.dispose(); renderer = null
  unavailable.value = true
}
watch(() => [props.camera.yaw, props.camera.pitch, props.camera.zoom, props.camera.panX, props.camera.panY], () => {
  if (typeof window !== 'undefined') requestDraw()
})
watch(() => props.resetVersion, () => {
  elapsed = 0; lastFrame = 0; lastPaint = 0
  openAmount = props.opened ? 1 : 0
  excitedTarget = 0; excitedAmount = 0
  if (typeof window !== 'undefined') requestDraw()
})
watch(() => props.opened, () => {
  excitedTarget = 0; excitedAmount = 0
  if (typeof window !== 'undefined') requestDraw()
}, { flush: 'sync' })
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', updateVisibility)
  document.addEventListener('visibilitychange', updateVisibility)
  const canvas = canvasRef.value
  if (!canvas) return
  resizeObserver = new ResizeObserver(() => requestDraw())
  resizeObserver.observe(canvas)
  intersectionObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    updateVisibility()
  })
  intersectionObserver.observe(canvas)
  startRenderer()
})
onBeforeUnmount(() => {
  disposed = true
  if (frame) cancelAnimationFrame(frame)
  renderer?.dispose()
  renderer = null
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  motion?.removeEventListener('change', updateVisibility)
  document.removeEventListener('visibilitychange', updateVisibility)
})
</script>

<template>
  <div class="bs-hologram-scene">
    <canvas ref="canvasRef" :aria-label="label" role="img" class="bs-hologram-scene__canvas" @webglcontextlost="onContextLost" @webglcontextrestored="startRenderer" />
    <p v-if="unavailable" class="bs-hologram-scene__unavailable" role="status">{{ unavailableLabel }}</p>
  </div>
</template>

<style scoped>
.bs-hologram-scene { position: absolute; inset: 0; }
.bs-hologram-scene__canvas { display: block; width: 100%; height: 100%; }
.bs-hologram-scene__unavailable { position: absolute; inset: 50% 24px auto; margin: 0; text-align: center; color: var(--bs-cloud-gray); font-size: 14px; }
</style>
