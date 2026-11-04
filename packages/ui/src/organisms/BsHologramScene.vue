<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { SpatialViewportCamera } from '@building-suit/ux'
import { createHologramRenderer } from '../utils/hologramScene'
import type { HologramPalette, HologramRenderer } from '../utils/hologramScene'

const props = defineProps<{ camera: Readonly<SpatialViewportCamera>; resetVersion: number; label: string; unavailableLabel: string }>()
const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
const unavailable = ref(false)
let renderer: HologramRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let motion: MediaQueryList | null = null
let frame = 0, visible = true, started = 0, disposed = false

function requestDraw() {
  if (!disposed && !frame && visible && !document.hidden && renderer) frame = requestAnimationFrame(draw)
}
function draw(time: number) {
  frame = 0
  if (!renderer || !visible || document.hidden) return
  if (!started) started = time
  renderer.draw(props.camera, motion?.matches ? 0 : (time - started) / 1000)
  if (!motion?.matches) requestDraw()
}
function updateVisibility() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
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
  const palette: HologramPalette = { light: read('--bs-color-secondary-pale-sky'), blue: read('--bs-color-secondary-sky-steel'), metal: read('--bs-color-brand-navy-surface') }
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
  started = 0
  if (typeof window !== 'undefined') requestDraw()
})
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', updateVisibility)
  document.addEventListener('visibilitychange', updateVisibility)
  const canvas = canvasRef.value
  if (!canvas) return
  resizeObserver = new ResizeObserver(requestDraw)
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
