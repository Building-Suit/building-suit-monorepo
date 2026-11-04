<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { SpatialViewportCamera } from '@building-suit/ux'
import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'
import { createHologramRenderer } from '../utils/hologramScene'
import type { HologramLayout, HologramPalette, HologramRenderer } from '../utils/hologramScene'

const props = withDefaults(defineProps<{ camera: Readonly<SpatialViewportCamera>; resetVersion: number; label: string; unavailableLabel: string; opened?: boolean; officeLayerCount?: number; departments?: readonly HqDepartmentOffice[]; executiveLabel?: string }>(), { opened: false, officeLayerCount: 0, departments: () => [], executiveLabel: '' })
const emit = defineEmits<{ activate: []; openPlans: []; hoverChange: [active: boolean] }>()
const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
const unavailable = ref(false)
let renderer: HologramRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let motion: MediaQueryList | null = null
let frame = 0, visible = true, elapsed = 0, lastFrame = 0, disposed = false
let lastPaint = 0, needsDraw = true
let openAmount = props.opened ? 1 : 0, excitedAmount = 0, excitedTarget = 0
let hoverActive = false
let constructionUntil = 0
const knownDepartments = new Set<string>()
const officeLabels = new Map<string, HTMLElement>()
const labelPoses = new WeakMap<HTMLElement, string>()
const executiveLabelRef = shallowRef<HTMLButtonElement | null>(null)
const sceneLayout: HologramLayout = { officeLayerCount: props.officeLayerCount, departments: props.departments }

function publishHover(active: boolean) {
  if (active === hoverActive) return
  hoverActive = active
  emit('hoverChange', active)
}
function clearHoverAndShake() {
  excitedTarget = 0; excitedAmount = 0
  publishHover(false)
}
function activateAt(clientX: number, clientY: number) {
  if (disposed || unavailable.value || !visible || !renderer) return false
  if (renderer.hitTestOrb(clientX, clientY)) { emit('activate'); return true }
  if (renderer.hitTestExecutive(clientX, clientY)) { emit('openPlans'); return true }
  return false
}
function setExcitedAt(clientX: number, clientY: number, active: boolean) {
  const eligible = active && !disposed && !unavailable.value && visible && typeof document !== 'undefined' && !document.hidden
  const orbHit = eligible && Boolean(renderer?.hitTestOrb(clientX, clientY))
  const executiveHit = eligible && !orbHit && Boolean(renderer?.hitTestExecutive(clientX, clientY))
  const nextTarget = orbHit && !props.opened && openAmount < 0.001 ? 1 : 0
  publishHover(nextTarget === 1 || executiveHit)
  if (nextTarget !== excitedTarget) {
    excitedTarget = nextTarget
    if (props.opened || openAmount > 0.001) excitedAmount = 0
    if (typeof window !== 'undefined') requestDraw()
  }
  return orbHit || executiveHit
}
defineExpose({ activateAt, setExcitedAt })

function setOfficeLabel(id: string, element: unknown) {
  if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) officeLabels.set(id, element)
  else officeLabels.delete(id)
}
function updateLabel(element: HTMLElement, anchor: ReturnType<HologramRenderer['projectExecutiveAnchor']>) {
  const hidden = !anchor?.visible || unavailable.value || !visible
  const pose = hidden || !anchor ? 'hidden' : `${anchor.x.toFixed(1)},${anchor.y.toFixed(1)}`
  if (labelPoses.get(element) === pose) return
  labelPoses.set(element, pose)
  element.hidden = hidden
  if (!hidden && anchor) element.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0) translate(-50%, -100%)`
}
function updateLabels() {
  for (const [id, element] of officeLabels) updateLabel(element, renderer?.projectOfficeAnchor(id) ?? null)
  if (executiveLabelRef.value) updateLabel(executiveLabelRef.value, renderer?.projectExecutiveAnchor() ?? null)
}
function hideLabels() {
  for (const element of officeLabels.values()) updateLabel(element, null)
  if (executiveLabelRef.value) updateLabel(executiveLabelRef.value, null)
}
function noteNewDepartments() {
  let added = false
  for (const department of props.departments) if (!knownDepartments.has(department.id)) { knownDepartments.add(department.id); added = true }
  if (added && typeof performance !== 'undefined') constructionUntil = performance.now() + 2600
}

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
  const minimumFrame = transitioning || excitedTarget || time < constructionUntil ? 1000 / 60 : 1000 / 30
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
  sceneLayout.reducedMotion = reduced
  renderer.draw(props.camera, reduced ? 0 : elapsed, { open: openAmount, excited: excitedAmount, opened: props.opened }, sceneLayout)
  updateLabels()
  if (!motion?.matches) requestDraw(false)
}
function updateVisibility() {
  if (!visible || document.hidden) { clearHoverAndShake(); hideLabels() }
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  lastFrame = 0; lastPaint = 0
  requestDraw()
}
function startRenderer() {
  const canvas = canvasRef.value
  if (!canvas) return
  clearHoverAndShake()
  hideLabels()
  renderer?.dispose()
  const style = getComputedStyle(canvas)
  const read = (token: string): [number, number, number] => {
    const hex = style.getPropertyValue(token).trim().replace('#', '')
    return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number]
  }
  const palette: HologramPalette = {
    coal: read('--bs-color-neutral-ink'), charcoal: read('--bs-color-neutral-charcoal'),
    graphite: read('--bs-color-neutral-graphite'), steelGray: read('--bs-color-neutral-steel-gray'),
    silver: read('--bs-color-brand-soft-silver'), pearl: read('--bs-color-brand-pearl-white'),
    gold: read('--bs-color-brand-premium-gold'),
  }
  renderer = createHologramRenderer(canvas, palette)
  unavailable.value = !renderer
  requestDraw()
}
function onContextLost(event: Event) {
  event.preventDefault()
  clearHoverAndShake()
  hideLabels()
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  renderer?.dispose(); renderer = null
  unavailable.value = true
}
watch(() => [props.camera.yaw, props.camera.pitch, props.camera.zoom, props.camera.panX, props.camera.panY], () => {
  clearHoverAndShake()
  if (typeof window !== 'undefined') requestDraw()
})
watch(() => props.resetVersion, () => {
  elapsed = 0; lastFrame = 0; lastPaint = 0
  openAmount = props.opened ? 1 : 0
  clearHoverAndShake()
  if (typeof window !== 'undefined') requestDraw()
})
watch(() => props.opened, () => {
  clearHoverAndShake()
  if (typeof window !== 'undefined') requestDraw()
}, { flush: 'sync' })
watch(() => props.officeLayerCount, count => {
  sceneLayout.officeLayerCount = count
  if (typeof window !== 'undefined') requestDraw()
}, { flush: 'sync' })
watch(() => props.departments, departments => {
  sceneLayout.departments = departments
  noteNewDepartments()
  if (typeof window !== 'undefined') requestDraw()
}, { flush: 'sync' })
watch(() => props.executiveLabel, () => {
  if (typeof window !== 'undefined') requestDraw()
}, { flush: 'post' })
onMounted(() => {
  noteNewDepartments()
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
  clearHoverAndShake()
  if (frame) cancelAnimationFrame(frame)
  renderer?.dispose()
  renderer = null
  hideLabels(); officeLabels.clear(); knownDepartments.clear()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  motion?.removeEventListener('change', updateVisibility)
  document.removeEventListener('visibilitychange', updateVisibility)
})
</script>

<template>
  <div class="bs-hologram-scene">
    <canvas ref="canvasRef" :aria-label="label" role="img" class="bs-hologram-scene__canvas" @webglcontextlost="onContextLost" @webglcontextrestored="startRenderer" />
    <div class="bs-hologram-scene__labels">
      <span v-for="department in departments" :key="department.id" :ref="element => setOfficeLabel(department.id, element)" class="bs-hologram-scene__office-label" hidden>{{ department.name }}</span>
      <button v-if="executiveLabel" ref="executiveLabelRef" type="button" class="bs-hologram-scene__office-label bs-hologram-scene__executive-label" hidden @pointerdown.stop @pointerup.stop @click.stop="emit('openPlans')">{{ executiveLabel }}</button>
    </div>
    <p v-if="unavailable" class="bs-hologram-scene__unavailable" role="status">{{ unavailableLabel }}</p>
  </div>
</template>

<style scoped>
.bs-hologram-scene { position: absolute; inset: 0; }
.bs-hologram-scene__canvas { display: block; width: 100%; height: 100%; }
.bs-hologram-scene__labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.bs-hologram-scene__office-label { position: absolute; inset: 0 auto auto 0; width: max-content; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 10px; border: 1px solid var(--bs-color-neutral-graphite); border-radius: 8px; background: var(--bs-color-neutral-charcoal); color: var(--bs-color-brand-soft-silver); font: inherit; font-size: 12px; line-height: 1.4; }
.bs-hologram-scene__office-label[hidden] { display: none; }
.bs-hologram-scene__executive-label { pointer-events: auto; border-color: var(--bs-color-brand-premium-gold); cursor: pointer; }
.bs-hologram-scene__executive-label:focus-visible { outline: 2px solid var(--bs-color-brand-premium-gold); outline-offset: 3px; }
.bs-hologram-scene__unavailable { position: absolute; inset: 50% 24px auto; margin: 0; text-align: center; color: var(--bs-color-brand-soft-silver); font-size: 14px; }
</style>
