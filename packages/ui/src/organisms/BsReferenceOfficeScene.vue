<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import type { LivingOfficeEmployee, LivingOfficeRoom } from '../types/livingOffice'
import type { createReferenceOfficeScene } from '../utils/referenceOfficeScene'

const props = withDefaults(defineProps<{
  rooms: LivingOfficeRoom[]
  employees: LivingOfficeEmployee[]
  loading?: boolean
  error?: string | null
}>(), { loading: false, error: null })
const root = ref<HTMLElement>(), stage = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>()
const descriptionId = useId() + '-reference-office-description'
const rendererState = ref<'loading' | 'webgl' | 'fallback'>('loading')
const reducedMotion = ref(false), visible = ref(true), scale = ref(1)
const stats = ref({ frames: 0, triangles: 0, rooms: 0, meshes: 0, textures: 0 })
const anchors = ref<{ key: string; x: number; y: number; visible: boolean }[]>([])
const roomList = computed(() => {
  const seen = new Set<string>()
  return props.rooms.filter(room => {
    if (!room.id || seen.has(room.id) || (room.kind !== 'executive' && room.kind !== 'department')) return false
    seen.add(room.id)
    return true
  })
})
const employeeList = computed(() => props.employees.filter(employee => roomList.value.some(room => room.id === employee.departmentId)))
const count = (id: string) => employeeList.value.filter(employee => employee.departmentId === id).length
const staffing = (number: number) => `${number} ${number === 1 ? 'agent' : 'agents'} / On demand`
const positions = computed(() => Object.fromEntries(anchors.value.filter(anchor => anchor.visible).map(anchor => [anchor.key, { left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }])))
const description = computed(() => `Three-dimensional Company HQ. ${roomList.value.map(room => `${room.label}: ${count(room.id)} employees`).join('. ')}. ${employeeList.value.map(employee => `${employee.name}, ${employee.role}`).join('; ')}. This is an appearance review. Illustrated navigation and controls are inactive. On demand describes configuration, not live execution.`)
const frameStyle = computed(() => ({ transform: `translate(-50%, -50%) scale(${scale.value})` }))
const extraMarkerPositions = [{ x: 76, y: 18 }, { x: 96, y: 43 }, { x: 76, y: 68 }, { x: 50, y: 87 }, { x: 24, y: 68 }, { x: 4, y: 43 }]
const extraColors = ['#f5c33b', '#ce53cf', '#8450f0', '#31b4b6', '#ed4856', '#3db76c']
const roomColor = (room: LivingOfficeRoom) => room.id === 'ceo' ? '#3478ef' : room.id === 'hr' ? '#f39a12' : extraColors[Math.max(0, roomList.value.filter(item => item.id !== 'ceo' && item.id !== 'hr').findIndex(item => item.id === room.id)) % extraColors.length]
const markers = computed(() => {
  let extra = 0
  return roomList.value.map(room => ({ room, position: room.id === 'ceo' ? { x: 50, y: 3 } : room.id === 'hr' ? { x: 24, y: 18 } : extraMarkerPositions[extra++ % extraMarkerPositions.length]! }))
})
let engine: ReturnType<typeof createReferenceOfficeScene> | undefined
let resizeObserver: ResizeObserver | undefined, intersectionObserver: IntersectionObserver | undefined, preference: MediaQueryList | undefined
let dead = false, intersecting = true
function resize() {
  if (!root.value) return
  const bounds = root.value.getBoundingClientRect()
  scale.value = Math.max(.05, Math.min(bounds.width / 1600, bounds.height / 900))
  engine?.resize(1582 * scale.value, 820 * scale.value)
}
function update() { engine?.setData(roomList.value, employeeList.value) }
function visibility() {
  visible.value = intersecting && !document.hidden
  engine?.setVisible(visible.value)
}
function motionPreference() {
  reducedMotion.value = !!preference?.matches
  engine?.setReducedMotion(reducedMotion.value)
}
function lost() {
  if (dead) return
  rendererState.value = 'fallback'
  anchors.value = []
  queueMicrotask(() => { engine?.dispose(); engine = undefined })
}
onMounted(async () => {
  preference = matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference(); preference.addEventListener('change', motionPreference)
  document.addEventListener('visibilitychange', visibility)
  resizeObserver = new ResizeObserver(resize); if (root.value) resizeObserver.observe(root.value)
  intersectionObserver = new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting ?? true; visibility() })
  if (root.value) intersectionObserver.observe(root.value)
  resize(); visibility()
  try {
    const { createReferenceOfficeScene: create } = await import('../utils/referenceOfficeScene')
    if (dead || !canvas.value) return
    engine = create({
      canvas: canvas.value,
      anchors: values => { if (!dead) anchors.value = values },
      lost,
      stats: value => { if (!dead) { stats.value = value; if (rendererState.value !== 'fallback' && value.frames > 0) rendererState.value = 'webgl' } },
    })
    resize(); motionPreference(); visibility(); update()
  } catch { lost() }
})
watch(() => [props.rooms, props.employees], update, { deep: true })
onBeforeUnmount(() => {
  dead = true; resizeObserver?.disconnect(); intersectionObserver?.disconnect()
  preference?.removeEventListener('change', motionPreference)
  document.removeEventListener('visibilitychange', visibility)
  engine?.dispose(); engine = undefined
})
</script>

<template>
  <section ref="root" class="bs-reference-office" :data-renderer="rendererState" :data-rendered-frames="stats.frames" :data-triangles="stats.triangles" :data-meshes="stats.meshes" :data-textures="stats.textures" :data-room-count="stats.rooms" :data-record-room-count="roomList.length" :data-room-ids="roomList.map(room => room.id).join(',')" :data-employee-model-count="anchors.filter(anchor => anchor.key.startsWith('employee:')).length" :data-reduced-motion="String(reducedMotion)" :data-visible="String(visible)" aria-label="Company HQ three-dimensional appearance review">
    <div class="bs-reference-office__frame" :style="frameStyle">
      <header class="bs-reference-office__header">
        <div class="bs-reference-office__brand">
          <svg class="bs-reference-office__brand-mark" viewBox="0 0 56 64" aria-hidden="true">
            <path d="M6 10L22 3l3 54-18 4z" fill="#89919c" /><path d="M7 10L22 4v53L7 61z" fill="#eceef0" />
            <text x="17" y="57" fill="#c5cad1" font-family="Arial,sans-serif" font-size="66" font-weight="800">B</text>
            <text x="15" y="55" fill="#f6f6f5" font-family="Arial,sans-serif" font-size="66" font-weight="800">B</text>
            <path d="M11 16l4-1v7l-4 1z M11 28l4-1v7l-4 1z M11 41l4-1v7l-4 1z" fill="#d8a44c" />
          </svg>
          <span>Building Suit <strong>HQ</strong></span>
        </div>
        <div class="bs-reference-office__tabs" aria-hidden="true"><span class="bs-reference-office__tab-active">Office</span><span>Tasks</span><span>Brain</span></div>
        <div class="bs-reference-office__presence"><i aria-hidden="true" />{{ staffing(employeeList.length) }}</div>
        <span class="bs-reference-office__ceo-action" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 1-8 8H7l-4 3 1-6a8 8 0 1 1 16-5Z" /><path d="M8 11h.1M12 11h.1M16 11h.1" /></svg>Talk to CEO</span>
        <span class="bs-reference-office__account" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3Z" /></svg></span>
      </header>

      <div ref="stage" class="bs-reference-office__stage">
        <canvas ref="canvas" class="bs-reference-office__canvas" data-testid="hq-reference-3d-canvas" role="img" aria-label="Company HQ rendered with three-dimensional geometry" :aria-describedby="descriptionId" />
        <template v-if="rendererState === 'webgl'">
          <div v-for="room in roomList" v-show="positions['room:' + room.id]" :key="room.id" class="bs-reference-office__room" :class="{ 'bs-reference-office__room--hr': room.id === 'hr' }" :data-room-id="room.id" :style="{ ...positions['room:' + room.id], '--room-color': roomColor(room) }">
            <span class="bs-reference-office__room-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.5" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></svg></span>
            <div><strong>{{ room.label }}</strong><span>{{ staffing(count(room.id)) }}</span></div>
          </div>
          <div v-if="positions['brain:brain']" class="bs-reference-office__brain" :style="positions['brain:brain']"><strong>COMPANY BRAIN</strong><span>Shared knowledge</span></div>
          <span v-for="employee in employeeList" v-show="positions['employee:' + employee.id]" :key="employee.id" class="bs-reference-office__employee" :data-employee-id="employee.id" :data-role="employee.role" :aria-label="employee.name + ', ' + employee.role" :style="positions['employee:' + employee.id]">{{ employee.name }}</span>
        </template>
        <p v-if="rendererState === 'fallback'" class="bs-reference-office__fallback" role="status">3D rendering is unavailable on this device. No image fallback is used. Reload with WebGL available to view the office.</p>
        <p v-else-if="rendererState === 'loading' || loading" class="bs-reference-office__notice" role="status">{{ loading ? 'Loading authorized office records…' : 'Preparing the 3D office…' }}</p>
        <p v-else-if="error" class="bs-reference-office__notice" role="status">{{ error }}</p>
        <p v-else-if="!roomList.length" class="bs-reference-office__notice">Sign in through the existing /auth/login route to load office records.</p>
      </div>

      <div class="bs-reference-office__workspace" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10" /></svg>On-demand workspace</div>
      <aside class="bs-reference-office__minimap" aria-label="Office overview, inactive">
        <div class="bs-reference-office__map">
          <span v-for="marker in markers" :key="marker.room.id" :data-minimap-room-id="marker.room.id" :style="{ left: marker.position.x + '%', top: marker.position.y + '%', background: roomColor(marker.room) }" :aria-label="marker.room.label" />
          <i aria-label="Company Brain" />
        </div>
        <div class="bs-reference-office__map-controls" aria-hidden="true"><span>−</span><span>+</span><span><svg viewBox="0 0 24 24"><path d="M14 4h6v6 M20 4l-7 7 M10 20H4v-6 M4 20l7-7" /></svg></span></div>
      </aside>
    </div>
    <p :id="descriptionId" class="bs-reference-office__description">{{ description }}</p>
  </section>
</template>

<style scoped>
.bs-reference-office { position: relative; width: 100%; height: 100svh; overflow: hidden; background: #080b12; color: #f2f3f6; font-family: var(--bs-font-family, 'Manrope Variable', sans-serif); }
.bs-reference-office__frame { position: absolute; top: 50%; left: 50%; width: 1600px; height: 900px; transform-origin: center; border: 1px solid #414858; border-radius: 27px; overflow: hidden; background: linear-gradient(115deg,#1d2330,#111722 70%); box-shadow: inset 0 1px 2px #79829622; }
.bs-reference-office__header { position: absolute; inset: 0 0 auto; height: 70px; }
.bs-reference-office__brand { position: absolute; left: 58px; top: 5px; display: flex; align-items: center; gap: 16px; height: 59px; font-size: 28px; font-weight: 800; letter-spacing: -.6px; }
.bs-reference-office__brand-mark { width: 58px; height: 61px; overflow: visible; }
.bs-reference-office__brand strong { color: #e7ad3a; font-weight: 800; }
.bs-reference-office__tabs { position: absolute; left: 655px; top: 14px; display: flex; width: 294px; height: 44px; padding: 3px; border-radius: 16px; background: #0e131ddd; box-shadow: inset 0 1px 2px #050911bb; font-size: 17px; font-weight: 500; }
.bs-reference-office__tabs span { display: grid; place-items: center; flex: 1; color: #c4c7d0; }
.bs-reference-office__tabs .bs-reference-office__tab-active { border: 1px solid #4c525f; border-radius: 12px; background: linear-gradient(#3c424e,#2c323e); color: #f8f8fa; font-weight: 700; box-shadow: 0 1px 3px #0007; }
.bs-reference-office__presence { position: absolute; left: 1155px; top: 15px; display: flex; align-items: center; justify-content: center; gap: 9px; width: 202px; height: 41px; border: 1px solid #34434b; border-radius: 13px; background: linear-gradient(110deg,#1a2d32,#17212a); box-shadow: 0 0 17px #47aa6b0b,inset 0 1px #ffffff08; font-size: 13px; font-weight: 650; white-space: nowrap; }
.bs-reference-office__presence i { width: 12px; height: 12px; border-radius: 50%; background: #2bd47e; box-shadow: 0 0 14px #22d57b40; }
.bs-reference-office__ceo-action { position: absolute; left: 1374px; top: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 150px; height: 41px; border: 1px solid #ffe28a; border-radius: 12px; background: linear-gradient(#ffd36a,#e9ab35); color: #282113; box-shadow: 0 0 20px #ffc44827,inset 0 1px 2px #fff4; font-size: 14px; font-weight: 800; }
.bs-reference-office__ceo-action svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
.bs-reference-office__account { position: absolute; left: 1540px; top: 13px; display: grid; place-items: center; width: 45px; height: 45px; border: 1px solid #454c5b; border-radius: 50%; background: linear-gradient(#3b424e,#252c39); box-shadow: 0 3px 7px #0005; }
.bs-reference-office__account svg { width: 24px; height: 24px; fill: #d5d8df; }
.bs-reference-office__stage { position: absolute; left: 8px; top: 69px; width: 1582px; height: 820px; overflow: hidden; border: 1px solid #41495d; border-radius: 25px; background: radial-gradient(ellipse at 22% 43%,#414b68,#2b334a 50%,#1a212d 100%); }
.bs-reference-office__canvas { display: block; width: 100%; height: 100%; pointer-events: none; }
.bs-reference-office__room,.bs-reference-office__brain { position: absolute; display: flex; align-items: center; transform: translate(-50%,-50%); padding: 7px 10px; border: 1px solid #535b6c; border-radius: 14px; background: linear-gradient(#1b202b,#111722); box-shadow: 0 4px 12px #0005,inset 0 1px #ffffff0b; pointer-events: none; }
.bs-reference-office__room { min-width: 220px; min-height: 52px; gap: 12px; }
.bs-reference-office__room--hr { min-width: 258px; }
.bs-reference-office__room-icon { display: grid; place-items: center; flex: 0 0 33px; width: 33px; height: 33px; border-radius: 8px; background: var(--room-color); box-shadow: inset 0 2px 4px #fff3,0 2px 6px #0004; }
.bs-reference-office__room-icon svg { width: 23px; height: 23px; fill: none; stroke: #fff; stroke-width: 1.6; stroke-linecap: round; }
.bs-reference-office__room > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.bs-reference-office__room strong { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; font-weight: 750; line-height: 19px; }
.bs-reference-office__room span:not(.bs-reference-office__room-icon) { color: #b7bdca; font-size: 13px; font-weight: 600; line-height: 18px; letter-spacing: .15px; white-space: nowrap; }
.bs-reference-office__brain { flex-direction: column; justify-content: center; width: 202px; min-height: 60px; gap: 2px; }
.bs-reference-office__brain strong { font-size: 17px; line-height: 23px; letter-spacing: .6px; font-weight: 850; }
.bs-reference-office__brain span { color: #aeb6c5; font-size: 15px; line-height: 20px; font-weight: 500; }
.bs-reference-office__employee { position: absolute; transform: translate(-50%,-100%); padding: 2px 5px; border: 1px solid #ffffff20; border-radius: 5px; background: #111925a8; color: #f5f7fb; font-size: 11px; line-height: 15px; font-weight: 700; text-shadow: 0 1px 2px #000; pointer-events: none; white-space: nowrap; }
.bs-reference-office__workspace { position: absolute; left: 29px; top: 828px; display: flex; align-items: center; gap: 10px; height: 43px; padding: 0 15px; border: 1px solid #4d5669; border-radius: 14px; background: linear-gradient(#1d2432,#141b27); box-shadow: 0 4px 12px #0004; font-size: 14px; font-weight: 650; }
.bs-reference-office__workspace svg { width: 23px; height: 23px; fill: #bac2cf30; stroke: #d9deea; stroke-width: 1.3; stroke-linejoin: round; }
.bs-reference-office__minimap { position: absolute; left: 1363px; top: 687px; width: 219px; height: 189px; border: 1px solid #4b5362; border-radius: 19px; background: linear-gradient(125deg,#171d29,#101620); box-shadow: 0 4px 12px #0004,inset 0 1px #ffffff0c; }
.bs-reference-office__map { position: absolute; left: 24px; top: 25px; width: 169px; height: 91px; border: 1px solid #464e5b; border-radius: 5px; background: #101620; }
.bs-reference-office__map > span { position: absolute; width: 23px; height: 14px; transform: translate(-50%,-50%); border-radius: 4px; }
.bs-reference-office__map > i { position: absolute; left: 50%; top: 48%; width: 12px; height: 12px; transform: translate(-50%,-50%); border-radius: 50%; background: #f0f2f8; }
.bs-reference-office__map-controls { position: absolute; left: 14px; right: 11px; bottom: 12px; display: flex; justify-content: space-between; gap: 9px; }
.bs-reference-office__map-controls > span { display: grid; place-items: center; width: 58px; height: 35px; border: 1px solid #3c4453; border-radius: 10px; background: linear-gradient(#2a3240,#1d2532); font-size: 25px; line-height: 1; color: #d9dee7; }
.bs-reference-office__map-controls svg { width: 22px; height: 22px; fill: none; stroke: #e1e5ef; stroke-width: 1.8; stroke-linecap: round; }
.bs-reference-office__notice,.bs-reference-office__fallback { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); width: max-content; max-width: 780px; margin: 0; color: #d3d9e6; text-align: center; font-size: 15px; line-height: 1.6; }
.bs-reference-office__fallback { top: 42%; max-width: 640px; padding: 22px; }
.bs-reference-office__description { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
