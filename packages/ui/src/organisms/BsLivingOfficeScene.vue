<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import type { LivingOfficeBrainActivity, LivingOfficeEmployee, LivingOfficeRoom, LivingOfficeSceneCopy } from '../types/livingOffice'
import type { OfficeAnchor, OfficePalette, createLivingOfficeScene } from '../utils/livingOfficeScene'

const props = withDefaults(defineProps<{
  rooms: LivingOfficeRoom[]
  employees: LivingOfficeEmployee[]
  brainActivity?: LivingOfficeBrainActivity[]
  evidenceReady?: boolean
  copy?: Partial<LivingOfficeSceneCopy>
}>(), { brainActivity: () => [], evidenceReady: true, copy: () => ({}) })
const emit = defineEmits<{ 'select-room': [id: string]; 'select-employee': [id: string]; 'select-brain': [] }>()
const text = computed(() => ({
  title: 'Company workspace', hint: 'Drag to orbit · scroll to zoom · select a person or office',
  fallback: '3D rendering is unavailable on this device. The office directory and all actions remain available.',
  loading: 'Preparing the 3D workspace…', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset view',
  rotateLeft: 'Rotate left', rotateRight: 'Rotate right', motion: 'Motion illustrates recorded state; it is not evidence of live execution.',
  pauseMotion: 'Pause motion', resumeMotion: 'Resume motion', directory: 'Office and employee directory', brain: 'Company Brain',
  empty: 'No employees in this department yet', departments: 'Offices', employees: 'People', ...props.copy,
}))
const root = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>()
const directoryId = useId() + '-office-directory'
const rendererState = ref<'loading' | 'webgl' | 'fallback'>('loading')
const reducedMotion = ref(false), paused = ref(false)
const selected = ref(''), anchorValues = ref<OfficeAnchor[]>([])
const stats = ref({ frames: 0, triangles: 0, creatingRooms: 0, pulses: 0, recipients: [] as string[] })
let engine: ReturnType<typeof createLivingOfficeScene> | undefined
let observer: ResizeObserver | undefined, intersection: IntersectionObserver | undefined, themeObserver: MutationObserver | undefined
let media: MediaQueryList | undefined, dead = false
const roomList = computed(() => props.rooms.filter(room => room.kind === 'department' || room.kind === 'executive').slice(0, 25))
const employeeList = computed(() => props.employees.filter(employee => roomList.value.some(room => room.id === employee.departmentId)).slice(0, 100))
const positions = computed(() => Object.fromEntries(anchorValues.value.map(anchor => [anchor.key, { left: anchor.x + 'px', top: anchor.y + 'px', visibility: anchor.visible ? 'visible' as const : 'hidden' as const }])) )
const initials = (name: string) => name.split(' ').map(part => part[0] || '').slice(0, 2).join('')
function selection(kind: 'room' | 'employee' | 'brain', id: string) {
  selected.value = kind + ':' + id
  engine?.select({ kind, id })
  if (kind === 'employee') emit('select-employee', id)
  else if (kind === 'room') emit('select-room', id)
  else emit('select-brain')
}
function palette(): OfficePalette {
  const style = getComputedStyle(root.value!)
  const css = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    background: css('--bs-bg', '#0B0B0D'), surface: css('--bs-surface', '#141416'), muted: css('--bs-surface-muted', '#1C1C1F'),
    border: css('--bs-border-strong', '#71717A'), text: css('--bs-text', '#FAFAFA'), accent: css('--bs-accent', '#EBB45A'),
    info: css('--bs-status-info', '#3B82F6'), success: css('--bs-status-success', '#22C55E'), warning: css('--bs-status-warning', '#F59E0B'), danger: css('--bs-status-error', '#EF4444'),
  }
}
function update() {
  engine?.update(roomList.value, employeeList.value, props.brainActivity, props.evidenceReady)
  if (!props.evidenceReady) stats.value = { ...stats.value, pulses: 0, recipients: [] }
}
function motion() { engine?.setMotion(paused.value, reducedMotion.value) }
function keyboard(event: KeyboardEvent) {
  if (event.target !== canvas.value || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'ArrowLeft') { event.preventDefault(); engine?.rotate(-.18) }
  else if (event.key === 'ArrowRight') { event.preventDefault(); engine?.rotate(.18) }
  else if (event.key === '+' || event.key === '=') { event.preventDefault(); engine?.zoom(.86) }
  else if (event.key === '-') { event.preventDefault(); engine?.zoom(1.16) }
  else if (event.key === 'Home') { event.preventDefault(); engine?.reset() }
}
const preference = () => { reducedMotion.value = !!media?.matches; motion() }
onMounted(async () => {
  media = matchMedia('(prefers-reduced-motion: reduce)'); preference(); media.addEventListener('change', preference)
  try {
    const { createLivingOfficeScene } = await import('../utils/livingOfficeScene')
    if (dead || !canvas.value) return
    engine = createLivingOfficeScene({
      canvas: canvas.value, palette: palette(),
      anchors: value => { anchorValues.value = value },
      select: value => selection(value.kind, value.id),
      stats: value => { stats.value = value; rendererState.value = 'webgl' },
      lost: () => { rendererState.value = 'fallback'; anchorValues.value = []; queueMicrotask(() => { engine?.dispose(); engine = undefined }) },
    })
    motion(); update()
    observer = new ResizeObserver(() => engine?.resize()); observer.observe(canvas.value)
    intersection = new IntersectionObserver(entries => engine?.setVisible(entries[0]?.isIntersecting ?? true)); intersection.observe(canvas.value)
    themeObserver = new MutationObserver(() => engine?.setPalette(palette()))
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
  } catch {
    engine?.dispose(); engine = undefined; rendererState.value = 'fallback'
  }
})
watch(() => [props.rooms, props.employees, props.brainActivity, props.evidenceReady], update, { deep: true })
watch(paused, motion)
onBeforeUnmount(() => {
  dead = true; observer?.disconnect(); intersection?.disconnect(); themeObserver?.disconnect()
  media?.removeEventListener('change', preference); engine?.dispose(); engine = undefined
})
</script>

<template>
  <section ref="root" class="bs-living-office" :aria-label="text.title" :data-renderer="rendererState" :data-reduced-motion="String(reducedMotion)" :data-motion="paused || reducedMotion ? 'paused' : 'enabled'" :data-rendered-frames="stats.frames" :data-triangles="stats.triangles" :data-creating-rooms="stats.creatingRooms" :data-brain-pulses="stats.pulses" :data-brain-recipients="stats.recipients.join(',')">
    <div class="bs-living-office__stage">
      <div class="bs-living-office__topline" aria-hidden="true"><span class="bs-living-office__eyebrow">3D / {{ text.title }}</span><span>{{ roomList.length }} {{ text.departments }} · {{ employeeList.length }} {{ text.employees }}</span></div>
      <a class="bs-living-office__directory-jump" :href="'#' + directoryId">{{ text.directory }}</a>
      <canvas ref="canvas" data-testid="hq-3d-canvas" class="bs-living-office__canvas" tabindex="0" role="img" :aria-label="text.title + '. ' + text.hint" @keydown="keyboard" />
      <div v-if="rendererState === 'loading'" class="bs-living-office__fallback" role="status"><span class="bs-living-office__orb" aria-hidden="true" /><p>{{ text.loading }}</p></div>
      <div v-if="rendererState === 'fallback'" class="bs-living-office__fallback" role="status"><span class="bs-living-office__orb" aria-hidden="true" /><p>{{ text.fallback }}</p></div>
      <div v-if="rendererState === 'webgl'" class="bs-living-office__labels">
        <button v-for="room in roomList" :key="room.id" type="button" class="bs-living-office__room-label" :data-room-id="room.id" :style="positions['room:' + room.id] || { visibility: 'hidden' }" :aria-pressed="selected === 'room:' + room.id" @click="selection('room', room.id)"><span aria-hidden="true">▦</span>{{ room.label }}</button>
        <button v-for="(employee, index) in employeeList" :key="employee.id" type="button" class="bs-living-office__person-label" :data-employee-id="employee.id" :data-status="employee.status" :data-person="index % 4" :style="positions['employee:' + employee.id] || { visibility: 'hidden' }" :aria-pressed="selected === 'employee:' + employee.id" @click="selection('employee', employee.id)"><span class="bs-living-office__status" aria-hidden="true" /><strong>{{ employee.name }}</strong><small>{{ employee.role }}</small><span class="bs-living-office__sr"> · {{ employee.statusLabel }}</span></button>
        <button type="button" class="bs-living-office__brain-label" :style="positions['brain:brain'] || { visibility: 'hidden' }" :aria-pressed="selected === 'brain:brain'" @click="selection('brain', 'brain')">{{ text.brain }}</button>
      </div>
      <div class="bs-living-office__tools" role="group" :aria-label="text.title">
        <button type="button" :aria-label="text.rotateLeft" :disabled="rendererState !== 'webgl'" @click="engine?.rotate(-.25)">↶</button>
        <button type="button" :aria-label="text.rotateRight" :disabled="rendererState !== 'webgl'" @click="engine?.rotate(.25)">↷</button>
        <span aria-hidden="true" />
        <button type="button" :aria-label="text.zoomOut" :disabled="rendererState !== 'webgl'" @click="engine?.zoom(1.16)">−</button>
        <button type="button" :aria-label="text.reset" :disabled="rendererState !== 'webgl'" @click="engine?.reset()">⌂</button>
        <button type="button" :aria-label="text.zoomIn" :disabled="rendererState !== 'webgl'" @click="engine?.zoom(.86)">+</button>
        <span aria-hidden="true" />
        <button type="button" :aria-label="paused ? text.resumeMotion : text.pauseMotion" :aria-pressed="paused || reducedMotion" :disabled="reducedMotion" @click="paused = !paused">{{ paused || reducedMotion ? '>' : '||' }}</button>
      </div>
      <p class="bs-living-office__hint">{{ text.hint }}</p>
    </div>
    <p class="bs-living-office__motion-note">{{ text.motion }}</p>
    <div :id="directoryId" class="bs-living-office__directory" :aria-label="text.directory" role="group" tabindex="-1">
      <article v-for="room in roomList" :key="room.id" class="bs-living-office__department">
        <button type="button" class="bs-living-office__department-title" :data-directory-room-id="room.id" :aria-pressed="selected === 'room:' + room.id" @click="selection('room', room.id)"><span aria-hidden="true">▦</span><strong>{{ room.label }}</strong><span aria-hidden="true">&gt;</span></button>
        <p v-if="!employeeList.some(person => person.departmentId === room.id)" class="bs-living-office__empty">{{ text.empty }}</p>
        <button v-for="employee in employeeList.filter(person => person.departmentId === room.id)" :key="employee.id" type="button" class="bs-living-office__person" :data-directory-employee-id="employee.id" :data-status="employee.status" :data-person="employeeList.findIndex(person => person.id === employee.id) % 4" :aria-pressed="selected === 'employee:' + employee.id" @click="selection('employee', employee.id)"><span class="bs-living-office__avatar" aria-hidden="true">{{ initials(employee.name) }}</span><span><strong>{{ employee.name }}</strong><small>{{ employee.role }}</small></span><span class="bs-living-office__state"><i class="bs-living-office__status" aria-hidden="true" />{{ employee.statusLabel }}</span></button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.bs-living-office { color: var(--bs-text); }
.bs-living-office__stage { position: relative; isolation: isolate; overflow: hidden; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: radial-gradient(ellipse at 50% 45%, var(--bs-surface-raised), var(--bs-bg) 76%); }
.bs-living-office__canvas { display: block; width: 100%; height: clamp(30rem, 65vw, 45rem); outline-offset: -.3rem; touch-action: none; }
.bs-living-office__canvas:focus-visible { outline: var(--bs-focus-ring-style); }
.bs-living-office__topline { position: absolute; top: var(--bs-space-4); inset-inline: var(--bs-space-5); z-index: 2; display: flex; justify-content: space-between; gap: var(--bs-space-3); pointer-events: none; font-size: var(--bs-type-body-s-size, .75rem); color: var(--bs-text-muted); }
.bs-living-office__eyebrow { text-transform: uppercase; letter-spacing: .12em; font-weight: 700; }
.bs-living-office__labels { position: absolute; inset: 0; pointer-events: none; }
.bs-living-office__directory-jump { display: none; }
.bs-living-office__labels button { position: absolute; pointer-events: auto; transform: translate(-50%, -100%); cursor: pointer; box-shadow: var(--bs-elevation-1); font: inherit; color: var(--bs-text); white-space: nowrap; border: 1px solid var(--bs-border-strong); background: var(--bs-surface); }
.bs-living-office__room-label { display: flex; align-items: center; gap: var(--bs-space-2); padding: .55rem .8rem; border-radius: var(--bs-radius-button); font-size: .8rem !important; font-weight: 700 !important; }
.bs-living-office__room-label > span { color: var(--bs-accent); }
.bs-living-office__person-label { display: grid; grid-template-columns: .45rem auto; gap: .1rem .4rem; padding: .4rem .6rem; border-radius: .65rem; text-align: start; line-height: 1.25; }
.bs-living-office__person-label strong { font-size: .75rem; }
.bs-living-office__person-label small { grid-column: 2; font-size: .65rem; color: var(--bs-text-muted); }
.bs-living-office__status { display: inline-block; width: .43rem; height: .43rem; background: var(--bs-text-muted); border-radius: 50%; align-self: center; flex-shrink: 0; }
[data-status='working'] .bs-living-office__status { background: var(--bs-status-success); }
[data-status='queued'] .bs-living-office__status { background: var(--bs-status-warning); }
[data-status='reviewing'] .bs-living-office__status { background: var(--bs-status-info); }
[data-status='blocked'] .bs-living-office__status { background: var(--bs-status-error); }
.bs-living-office__brain-label { border-color: var(--bs-accent) !important; border-radius: var(--bs-radius-button); padding: .5rem .65rem; color: var(--bs-accent) !important; font-size: .7rem !important; }
.bs-living-office button[aria-pressed='true'] { border-color: var(--bs-accent); box-shadow: 0 0 0 1px var(--bs-accent); }
.bs-living-office :is(button, a):focus-visible { outline: var(--bs-focus-ring-style); outline-offset: var(--bs-focus-ring-offset); }
.bs-living-office__tools { position: absolute; bottom: var(--bs-space-5); right: var(--bs-space-5); z-index: 3; display: flex; align-items: center; padding: .25rem; gap: .15rem; background: var(--bs-surface); border: 1px solid var(--bs-border-strong); border-radius: var(--bs-radius-button); box-shadow: var(--bs-elevation-2); }
.bs-living-office__tools button { display: grid; place-items: center; min-height: var(--bs-tap-target-min); min-width: var(--bs-tap-target-min); font-size: 1.2rem; line-height: 1; border: 0; border-radius: var(--bs-radius-button); color: var(--bs-text); background: transparent; cursor: pointer; }
.bs-living-office__tools button:hover:not(:disabled) { background: var(--bs-surface-muted); }
.bs-living-office__tools button:disabled { opacity: .45; cursor: default; }
.bs-living-office__tools > span { height: 1.2rem; width: 1px; background: var(--bs-border); }
.bs-living-office__hint { position: absolute; bottom: var(--bs-space-5); left: var(--bs-space-5); max-width: 45%; margin: 0; color: var(--bs-text-muted); font-size: .75rem; pointer-events: none; }
.bs-living-office__motion-note { margin: var(--bs-space-3) 0; color: var(--bs-text-muted); font-size: .75rem; line-height: 1.5; }
.bs-living-office__directory { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 23rem), 1fr)); gap: var(--bs-space-4); }
.bs-living-office__department { border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); padding: var(--bs-space-3); background: var(--bs-surface); }
.bs-living-office__department-title { display: flex; align-items: center; gap: var(--bs-space-2); width: 100%; color: var(--bs-text); background: transparent; border: 0; border-radius: var(--bs-radius-button); text-align: start; padding: var(--bs-space-2); min-height: var(--bs-tap-target-min); cursor: pointer; }
.bs-living-office__department-title > span:first-child { color: var(--bs-accent); font-size: 1.3rem; }
.bs-living-office__department-title > span:last-child { margin-inline-start: auto; color: var(--bs-text-muted); }
.bs-living-office__person { width: 100%; display: flex; align-items: center; gap: var(--bs-space-3); text-align: start; padding: var(--bs-space-3) var(--bs-space-2); border: 1px solid transparent; background: transparent; border-radius: var(--bs-radius-button); color: var(--bs-text); cursor: pointer; }
.bs-living-office__person:hover { background: var(--bs-surface-muted); }
.bs-living-office__person strong, .bs-living-office__person small { display: block; }
.bs-living-office__person small { color: var(--bs-text-muted); font-size: .75rem; margin-top: .2rem; }
.bs-living-office__avatar { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border: 1px solid var(--bs-border-strong); border-radius: 35%; color: var(--bs-accent); background: var(--bs-surface-muted); font-size: .8rem; font-weight: 700; }
.bs-living-office__person[data-person='1'] .bs-living-office__avatar { color: var(--bs-status-info); border-radius: 50%; }
.bs-living-office__person[data-person='2'] .bs-living-office__avatar { color: var(--bs-status-success); border-radius: 25%; }
.bs-living-office__person[data-person='3'] .bs-living-office__avatar { color: var(--bs-status-warning); border-radius: 15% 45%; }
.bs-living-office__state { display: flex; align-items: center; gap: .4rem; margin-inline-start: auto; font-size: .7rem; color: var(--bs-text-muted); }
.bs-living-office__empty { color: var(--bs-text-muted); margin: var(--bs-space-3); font-size: .8rem; }
.bs-living-office__fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--bs-space-4); padding: var(--bs-space-8); text-align: center; background: var(--bs-bg); }
.bs-living-office__fallback p { max-width: 32rem; color: var(--bs-text-muted); }
.bs-living-office__orb { display: block; width: 4rem; height: 4rem; transform: rotate(45deg); border: 1px solid var(--bs-accent); border-radius: 25%; background: var(--bs-surface); box-shadow: var(--bs-elevation-2); }
.bs-living-office__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 700px) {
  .bs-living-office__canvas { height: 34rem; }
  .bs-living-office__topline { inset-inline: var(--bs-space-3); flex-direction: column; gap: .35rem; }
  .bs-living-office__tools { inset-inline: auto var(--bs-space-3); bottom: var(--bs-space-3); }
  .bs-living-office__hint { display: none; }
  /* Show one focused label instead of overlapping every name over a small floor plan.
     The complete accessible directory remains available immediately below the scene. */
  .bs-living-office__labels button:not([aria-pressed='true']) { display: none; }
  .bs-living-office__labels button[aria-pressed='true'] { min-height: var(--bs-tap-target-min); max-width: min(16rem, 80vw); white-space: normal; }
  .bs-living-office__directory-jump { display: inline-flex; align-items: center; position: absolute; top: 4.5rem; inset-inline-start: var(--bs-space-3); z-index: 3; min-height: var(--bs-tap-target-min); max-width: calc(100% - 2 * var(--bs-space-3)); padding-inline: var(--bs-space-2); color: var(--bs-text); font-size: .75rem; text-underline-offset: .2em; }
  .bs-living-office__person-label { padding: .4rem .6rem; }
  .bs-living-office__room-label { padding: .5rem .65rem; font-size: .75rem !important; }
}
</style>
