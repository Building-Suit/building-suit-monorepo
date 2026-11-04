<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'
import { SPATIAL_VIEWPORT_DEFAULT_CAMERA, useSpatialViewport } from '@building-suit/ux'
import type { SpatialViewportCamera } from '@building-suit/ux'
import type { HqBrainPresentation, HqLayoutContent, HqUserPresentation } from '../types/hqLayoutPresentation'
import { hologramFloorRadius } from '../utils/hologramScene'

const props = defineProps<{ content: HqLayoutContent; brain?: HqBrainPresentation; user?: HqUserPresentation; officeLayerCount?: number }>()
const emit = defineEmits<{ refreshBrain: []; selectBrainNote: [id: string] }>()
const sceneRef = shallowRef<{ activateAt: (x: number, y: number) => boolean; setExcitedAt: (x: number, y: number, active: boolean) => boolean } | null>(null)
const brainVisible = ref(false)
const brainPanelPresent = ref(false)
const orbHovered = ref(false)
const feedback = (x: number, y: number, active: boolean) => { sceneRef.value?.setExcitedAt(x, y, active) }
const { viewportRef, camera, resetVersion, isInteracting, zoomPercent, canZoomIn, canZoomOut, onPointerDown, onPointerMove, onPointerEnd, onPointerLeave, onWheel, onKeydown, zoomBy, reset, transitionTo } = useSpatialViewport((x, y) => sceneRef.value?.activateAt(x, y), { onHover: feedback, onHold: feedback }, { zoomLocked: () => brainVisible.value || brainPanelPresent.value })
const panelTitleRef = shallowRef<HTMLElement | null>(null)
const ui = useUiCopy()
let returnFocus: HTMLElement | null = null
let previousCamera: SpatialViewportCamera | null = null
const search = ref<string | number>('')
const noteLimit = ref(40)
const brainCopy = computed(() => props.content.companyBrain)
const brainStatus = computed(() => props.brain?.status ?? 'unavailable')
const brainStatusLabel = computed(() => {
  if (props.brain?.reason === 'not-configured') return brainCopy.value.setupRequiredLabel
  if (props.brain?.reason === 'authorization-required') return brainCopy.value.authorizationRequiredLabel
  return ({ loading: brainCopy.value.loadingLabel, connected: brainCopy.value.connectedLabel, unavailable: brainCopy.value.unavailableLabel, error: brainCopy.value.errorLabel })[brainStatus.value]
})
const visibleNotes = computed(() => {
  const query = String(search.value).trim().toLocaleLowerCase()
  return (props.brain?.notes ?? []).filter(note => !query || `${note.title} ${note.path}`.toLocaleLowerCase().includes(query))
})
const renderedNotes = computed(() => visibleNotes.value.slice(0, noteLimit.value))
watch(search, () => { noteLimit.value = 40 })
async function openBrain() {
  if (brainVisible.value) return
  returnFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousCamera = { ...camera }
  brainPanelPresent.value = true
  brainVisible.value = true
  transitionTo({ yaw: 0.35, pitch: 0.2, zoom: 1.7, panX: 0, panY: 0.57 })
  await nextTick()
  if (brainVisible.value) panelTitleRef.value?.focus({ preventScroll: true })
}
function closeBrain(restoreCamera = true) {
  if (!brainVisible.value) return
  brainVisible.value = false
  if (restoreCamera && previousCamera) transitionTo(previousCamera)
  previousCamera = null
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  else viewportRef.value?.focus({ preventScroll: true })
  returnFocus = null
}
function resetScene() { closeBrain(false); reset() }
function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && brainVisible.value) { event.preventDefault(); closeBrain(); return }
  // Notes retain native scrolling/navigation; manual camera zoom is locked
  // centrally while this panel is open, including shortcuts on the canvas.
  if (event.target instanceof Element && event.target.closest('.bs-hq-layout__brain-panel')) return
  onKeydown(event)
}
watch(resetVersion, () => closeBrain(false))
const userInitials = computed(() => props.user?.displayName.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('') ?? '')
const floorRadius = computed(() => hologramFloorRadius(props.officeLayerCount))
const mapScale = computed(() => 45 / floorRadius.value)
const hintId = useId()
const brainPanelId = useId()
const brainTitleId = useId()
const orbMarker = computed(() => ({
  left: `${Math.max(9, Math.min(91, 50 - camera.panX * mapScale.value))}%`,
  top: `${Math.max(12, Math.min(88, 50 + camera.panY * mapScale.value))}%`,
}))
const viewMarker = computed(() => ({
  width: `${Math.min(94, 62 * hologramFloorRadius() / floorRadius.value / camera.zoom)}%`,
  height: `${Math.min(90, 62 * hologramFloorRadius() / floorRadius.value / camera.zoom)}%`,
  transform: `translate(-50%, -50%) rotate(${(camera.yaw - SPATIAL_VIEWPORT_DEFAULT_CAMERA.yaw) * 180 / Math.PI}deg)`,
}))
</script>

<template>
  <div class="bs-hq-layout">
    <main class="bs-hq-layout__workspace-area" :class="{ 'bs-hq-layout__workspace-area--brain': brainVisible }" @keydown="onWorkspaceKeydown">
    <section ref="viewportRef" class="bs-hq-layout__canvas" :class="{ 'bs-hq-layout__canvas--interacting': isInteracting, 'bs-hq-layout__canvas--orb-hovered': orbHovered }" :aria-label="content.canvasLabel" :aria-describedby="hintId" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="onPointerLeave" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd" @wheel="onWheel" @auxclick.prevent @contextmenu.prevent>
      <BsHologramScene ref="sceneRef" :camera="camera" :office-layer-count="officeLayerCount" :opened="brainVisible" :reset-version="resetVersion" :label="content.hologramLabel" :unavailable-label="content.sceneUnavailableLabel" @activate="openBrain" @hover-change="orbHovered = $event" />
      <div class="bs-hq-layout__brand" data-spatial-controls>
        <img :src="content.logoSrc" alt="" width="32" height="44">
        <h1>{{ content.brandName }} <span>{{ content.brandSuffix }}</span></h1>
      </div>
      <nav class="bs-hq-layout__navigation" :aria-label="content.workspaceLabel" data-spatial-controls>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': !brainVisible }" :aria-current="!brainVisible ? 'page' : undefined" @click="closeBrain()">{{ content.workspaceLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.tasksLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.calendarLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': brainVisible }" :aria-label="brainCopy.openLabel" :aria-controls="brainPanelId" :aria-expanded="brainVisible" @click="openBrain">{{ content.brainLabel }}</BsButton>
      </nav>
      <aside class="bs-hq-layout__session" data-spatial-controls>
        <span class="bs-hq-layout__status"><span aria-hidden="true" />{{ content.statusLabel }}</span>
        <BsButton variant="accent" class="bs-hq-layout__ceo" disabled><BsIcon name="chat" :size="17" />{{ content.talkToCeoLabel }}</BsButton>
        <div v-if="user" class="bs-hq-layout__account" :aria-label="content.profileLabel">
          <span class="bs-hq-layout__avatar"><img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" width="30" height="30"><span v-else>{{ userInitials }}</span></span>
          <span class="bs-hq-layout__identity"><strong>{{ user.displayName }}</strong><small v-if="user.detailLabel">{{ user.detailLabel }}</small></span>
        </div>
        <BsButton v-else variant="text" class="bs-hq-layout__login" disabled><BsIcon name="user" :size="18" />{{ content.loginLabel }}</BsButton>
      </aside>
      <div class="bs-hq-layout__footer" dir="ltr">
        <div class="bs-hq-layout__workspace-info" dir="auto">
          <p :id="hintId" class="bs-hq-layout__gesture-hint"><span class="bs-hq-layout__mouse-hint">{{ content.mouseControlsLabel }}</span><span class="bs-hq-layout__touch-hint">{{ content.touchControlsLabel }}</span><span class="bs-hq-layout__keyboard-hint">{{ content.keyboardControlsLabel }}</span></p>
        </div>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel" data-spatial-controls>
          <div class="bs-hq-layout__minimap" role="img" :aria-label="`${content.minimapLabel}, ${content.zoomLabel}: ${zoomPercent}%`">
            <span class="bs-hq-layout__minimap-view" :style="viewMarker" aria-hidden="true" />
            <span class="bs-hq-layout__orb-marker" :style="orbMarker" aria-hidden="true"><BsIcon name="orb" :size="18" /></span>
            <span class="bs-hq-layout__zoom-value" :aria-label="content.zoomLabel">{{ zoomPercent }}%</span>
          </div>
          <div class="bs-hq-layout__zoom">
            <BsButton variant="icon" :aria-label="content.zoomOutLabel" :disabled="!canZoomOut" @click="zoomBy(1 / 1.2)"><BsIcon name="minus" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.zoomInLabel" :disabled="!canZoomIn" @click="zoomBy(1.2)"><BsIcon name="add" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.fitViewLabel" :title="content.fitViewLabel" @click="resetScene"><BsIcon name="repeat" :size="21" /></BsButton>
          </div>
        </aside>
      </div>
    </section>
    <Transition name="bs-hq-brain-slide" @after-leave="brainPanelPresent = false">
    <aside v-if="brainVisible" :id="brainPanelId" v-memo="[brain, brainCopy, search, noteLimit]" class="bs-hq-layout__brain-panel" :aria-labelledby="brainTitleId" @wheel.stop @keydown.esc.stop.prevent="closeBrain()">
      <header class="bs-hq-layout__brain-heading">
        <h2 :id="brainTitleId" ref="panelTitleRef" tabindex="-1">{{ brainCopy.title }}</h2>
        <BsButton variant="icon" :aria-label="ui('close')" @click="closeBrain()"><BsIcon name="close" :size="20" /></BsButton>
      </header>
      <section class="bs-hq-brain" :aria-label="brainCopy.title">
        <div class="bs-hq-brain__source">
          <div><strong role="status">{{ brainStatusLabel }}</strong><p>{{ brainCopy.sourceLabel }} · {{ brainCopy.readOnlyLabel }}</p><p>{{ brainCopy.freshnessLabel }}</p><small v-if="brain?.observedLabel">{{ brainCopy.observedLabel }}: {{ brain.observedLabel }}</small></div>
          <BsButton :pending="brain?.refreshing" :disabled="brainStatus === 'loading'" @click="emit('refreshBrain')">{{ brainCopy.refreshLabel }}</BsButton>
        </div>
        <p v-if="brain?.reason === 'not-configured' || brain?.reason === 'authorization-required'" role="status">{{ brainCopy.setupInstructionsLabel }}</p>
        <p v-if="brain?.partial" role="status">{{ brainCopy.partialLabel }}</p>
        <div v-if="brainStatus === 'connected'" class="bs-hq-brain__body">
          <nav class="bs-hq-brain__directory" :aria-label="brainCopy.searchLabel">
            <BsInput v-model="search" type="search" :aria-label="brainCopy.searchLabel" :placeholder="brainCopy.searchLabel" />
            <p v-if="!visibleNotes.length" role="status">{{ brainCopy.emptyLabel }}</p>
            <ul v-else><li v-for="note in renderedNotes" :key="note.id"><BsButton variant="text" :aria-pressed="brain?.selectedId === note.id" @click="emit('selectBrainNote', note.id)"><strong>{{ note.title }}</strong><small dir="auto">{{ note.path }}</small></BsButton></li></ul>
            <BsButton v-if="renderedNotes.length < visibleNotes.length" variant="text" @click="noteLimit += 40">{{ brainCopy.showMoreLabel }}</BsButton>
          </nav>
          <article class="bs-hq-brain__note" :aria-busy="brain?.noteStatus === 'loading'" aria-live="polite">
            <p v-if="brain?.noteStatus === 'loading'">{{ brainCopy.loadingLabel }}</p>
            <p v-else-if="brain?.noteStatus === 'error'" role="alert">{{ brainCopy.noteErrorLabel }}</p>
            <template v-else-if="brain?.note">
              <h2>{{ brain.note.title }}</h2><p dir="auto">{{ brain.note.path }}</p><small>{{ brainCopy.modifiedLabel }}: {{ brain.note.modifiedLabel }} · {{ brainCopy.versionLabel }}: {{ brain.note.version }}</small>
              <pre dir="auto">{{ brain.note.content }}</pre>
            </template>
            <p v-else>{{ brainCopy.selectLabel }}</p>
          </article>
        </div>
      </section>
    </aside>
    </Transition>
    </main>
  </div>
</template>

<style scoped>
.bs-hq-layout {
  color-scheme: dark;
  display: flex;
  height: 100svh;
  min-height: 360px;
  padding: var(--bs-space-2);
  overflow: hidden;
  color: var(--bs-pearl-white);
  background: var(--bs-color-neutral-ink);
  font-family: var(--bs-font-latin);
}
.bs-hq-layout__workspace-area { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.bs-hq-layout__canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 12%, transparent);
  border-radius: 22px;
  background: radial-gradient(ellipse at 50% 30%, var(--bs-color-neutral-graphite), var(--bs-color-neutral-ink) 75%);
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 4%, transparent);
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.bs-hq-layout__canvas--orb-hovered { cursor: pointer; }
.bs-hq-layout__canvas--interacting { cursor: grabbing; }
.bs-hq-layout__canvas:focus-visible { outline: 2px solid var(--bs-premium-gold); outline-offset: -4px; }
.bs-hq-layout__brand { position: absolute; z-index: 2; inset-block-start: 18px; inset-inline-start: 20px; display: flex; align-items: center; gap: 11px; max-width: calc(50% - 28px); cursor: default; }
.bs-hq-layout__brand img { flex: none; width: 32px; height: 44px; object-fit: contain; }
.bs-hq-layout__brand h1 { margin: 0; font-size: 21px; font-weight: 650; line-height: 1.2; letter-spacing: -.5px; white-space: nowrap; }
.bs-hq-layout__brand h1 span { color: var(--bs-premium-gold); }
.bs-hq-layout__navigation { position: absolute; z-index: 2; top: 18px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 2px; width: max-content; max-width: calc(100% - 32px); padding: 4px; border: 1px solid var(--bs-color-gray-800); border-radius: 15px; background: var(--bs-color-neutral-charcoal); cursor: default; }
.bs-hq-layout .bs-hq-layout__tab { min-width: 0; min-height: 38px; padding: 8px 14px; border: 1px solid transparent; border-radius: 11px; background: transparent; color: var(--bs-soft-silver); font-size: 13px; font-weight: 500; line-height: 20px; white-space: nowrap; }
.bs-hq-layout .bs-hq-layout__tab--selected { border-color: color-mix(in srgb, var(--bs-premium-gold) 35%, transparent); background: var(--bs-color-neutral-graphite); color: var(--bs-pearl-white); font-weight: 650; }
.bs-hq-layout__session { position: absolute; z-index: 2; inset-block-start: 18px; inset-inline-end: 20px; display: grid; gap: 7px; width: 204px; padding: 11px; border: 1px solid var(--bs-color-gray-800); border-radius: 16px; background: var(--bs-color-neutral-charcoal); box-shadow: 0 4px 16px color-mix(in srgb, var(--bs-color-neutral-ink) 20%, transparent); cursor: default; }
.bs-hq-layout__status { display: flex; align-items: center; gap: 7px; min-height: 20px; color: var(--bs-soft-silver); font-size: 11px; line-height: 1.5; }
.bs-hq-layout__status > span { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-layout .bs-hq-layout__ceo { display: inline-flex; justify-content: center; gap: 7px; width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--bs-premium-gold); border-radius: 9px; background: var(--bs-premium-gold); color: var(--bs-color-neutral-ink); font-size: 12px; font-weight: 650; line-height: 1.5; white-space: normal; }
.bs-hq-layout__account { display: flex; align-items: center; gap: 8px; min-width: 0; padding-top: 7px; border-top: 1px solid var(--bs-color-gray-800); }
.bs-hq-layout__avatar { flex: none; display: grid; place-items: center; width: 30px; height: 30px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 30%, transparent); border-radius: 50%; background: var(--bs-color-neutral-graphite); color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-layout__avatar img { width: 100%; height: 100%; object-fit: cover; }
.bs-hq-layout__identity { display: grid; gap: 2px; min-width: 0; text-align: start; }
.bs-hq-layout__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.bs-hq-layout__identity small { color: var(--bs-color-gray-400); font-size: 10px; overflow-wrap: anywhere; }
.bs-hq-layout .bs-hq-layout__login { display: flex; justify-content: center; gap: 7px; width: 100%; min-height: 32px; padding: 5px 8px; border: 1px solid var(--bs-color-gray-800); border-radius: 9px; background: var(--bs-color-neutral-graphite); color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-layout__tab:not(:disabled) { cursor: pointer; }
.bs-hq-layout__tab:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(-100% - var(--bs-space-3)); position: absolute; z-index: 3; inset-block: 80px var(--bs-space-3); inset-inline-start: var(--bs-space-3); width: min(420px, calc(100% - var(--bs-space-6))); display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; padding: var(--bs-space-5); border: 1px solid var(--bs-color-gray-800); border-radius: var(--bs-radius-modal); color: var(--bs-pearl-white); background: var(--bs-color-neutral-charcoal); box-shadow: var(--bs-shadow-elevation3-dark); user-select: text; }
:global([dir="rtl"]) .bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(100% + var(--bs-space-3)); }
.bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: transform 280ms cubic-bezier(.22, 1, .36, 1), opacity 200ms ease; will-change: transform; }
.bs-hq-brain-slide-enter-from, .bs-hq-brain-slide-leave-to { transform: translateX(var(--bs-brain-panel-offset)); opacity: 0; }
.bs-hq-layout__brain-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); margin-bottom: var(--bs-space-5); }
.bs-hq-layout__brain-heading h2 { margin: 0; font-size: 19px; font-weight: 650; }
.bs-hq-layout__brain-heading h2:focus { outline: none; }
.bs-hq-layout__brain-heading button { flex: none; color: var(--bs-soft-silver); }
.bs-hq-layout__brain-panel button:focus-visible, .bs-hq-layout__brain-panel input:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-brain { display: grid; gap: var(--bs-space-4); }
.bs-hq-brain__source { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-4); padding-bottom: var(--bs-space-4); border-bottom: 1px solid var(--bs-color-gray-800); font-size: 13px; line-height: 1.6; }
.bs-hq-brain__source p { margin: var(--bs-space-2) 0; color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-brain small { color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-brain__body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-5); }
.bs-hq-brain__directory { min-width: 0; }
.bs-hq-brain__directory input { color: var(--bs-pearl-white); background: var(--bs-color-neutral-graphite); border-color: var(--bs-color-gray-800); }
.bs-hq-brain__directory input::placeholder { color: var(--bs-color-gray-400); }
.bs-hq-brain__directory ul { display: grid; gap: var(--bs-space-1); padding: 0; margin: var(--bs-space-3) 0 0; list-style: none; max-height: 29dvh; overflow: auto; overscroll-behavior: contain; }
.bs-hq-brain__directory button { display: grid; width: 100%; min-width: 0; gap: var(--bs-space-1); padding: var(--bs-space-3); text-align: start; color: var(--bs-pearl-white); }
.bs-hq-brain__directory strong { font-size: 13px; font-weight: 600; }
.bs-hq-brain__directory small { overflow-wrap: anywhere; }
.bs-hq-brain__directory button:hover { background: var(--bs-color-neutral-graphite); }
.bs-hq-brain__directory button[aria-pressed="true"] { background: var(--bs-color-neutral-graphite); border-inline-start: 2px solid var(--bs-premium-gold); }
.bs-hq-brain__note { min-width: 0; padding-top: var(--bs-space-4); border-top: 1px solid var(--bs-color-gray-800); user-select: text; }
.bs-hq-brain__note h2 { margin: 0 0 var(--bs-space-2); font-size: 18px; }
.bs-hq-brain__note p { margin: var(--bs-space-2) 0; overflow-wrap: anywhere; }
.bs-hq-brain__note pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; line-height: 1.8; unicode-bidi: plaintext; }
.bs-hq-layout__footer { position: absolute; z-index: 2; inset: auto 0 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 16px; pointer-events: none; }
.bs-hq-layout__workspace-info { display: grid; min-width: 0; justify-items: start; gap: 8px; max-width: 340px; }
.bs-hq-layout__gesture-hint { margin: 0; color: var(--bs-soft-silver); opacity: .7; font-size: 10px; line-height: 1.6; }
.bs-hq-layout__touch-hint { display: none; }
.bs-hq-layout__keyboard-hint { display: block; }
.bs-hq-layout__view { display: flex; flex: none; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; cursor: default; }
.bs-hq-layout__minimap { position: relative; width: 104px; height: 104px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); border-radius: 50%; background: var(--bs-color-neutral-ink); box-shadow: 0 4px 14px color-mix(in srgb, var(--bs-color-neutral-ink) 25%, transparent); pointer-events: auto; }
.bs-hq-layout__zoom-value { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); padding: 1px 4px; border-radius: 4px; background: var(--bs-color-neutral-ink); color: var(--bs-soft-silver); font-size: 9px; line-height: 1.3; font-variant-numeric: tabular-nums; }
.bs-hq-layout__minimap-view { position: absolute; top: 50%; left: 50%; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 30%, transparent); background: color-mix(in srgb, var(--bs-soft-silver) 5%, transparent); border-radius: 3px; }
.bs-hq-layout__orb-marker { position: absolute; display: grid; place-items: center; width: 26px; height: 26px; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 50%, transparent); border-radius: 50%; color: var(--bs-premium-gold); background: var(--bs-color-neutral-graphite); box-shadow: 0 0 14px color-mix(in srgb, var(--bs-premium-gold) 12%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 36px); gap: 2px; padding: 4px; border: 1px solid var(--bs-color-gray-800); border-radius: 14px; background: var(--bs-color-neutral-charcoal); pointer-events: auto; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 36px; min-width: 0; height: 36px; padding: 0; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled) { cursor: pointer; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled):hover { background: var(--bs-color-neutral-graphite); border-color: var(--bs-premium-gold); color: var(--bs-pearl-white); }
.bs-hq-layout .bs-hq-layout__zoom button:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout .bs-hq-layout__zoom button:disabled { opacity: .4; }
:global([dir="rtl"]) .bs-hq-layout { font-family: var(--bs-font-arabic); }
:global([dir="rtl"]) .bs-hq-layout__brand h1 { letter-spacing: normal; }
:global([dir="rtl"]) .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { flex-direction: row-reverse; }
@media (max-width: 1000px) {
  .bs-hq-layout__navigation { top: 76px; }
  .bs-hq-layout__session { width: 196px; }
  .bs-hq-layout__brain-panel { inset-block-start: 132px; }
}
@media (max-width: 840px) {
  .bs-hq-layout__session { inset-block-start: 140px; inset-inline-end: 16px; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__workspace-info { display: none; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__minimap { display: none; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { padding: 10px; justify-content: flex-end; }
  .bs-hq-layout__brain-panel { inset-block-end: 84px; padding: var(--bs-space-4); }
  .bs-hq-brain__directory ul { max-height: 23dvh; }
}
@media (max-width: 520px) {
  .bs-hq-layout { padding: 5px; }
  .bs-hq-layout__canvas { border-radius: 17px; }
  .bs-hq-layout__brand { inset-block-start: 12px; inset-inline-start: 12px; gap: 8px; max-width: calc(100% - 24px); }
  .bs-hq-layout__brand img { width: 27px; height: 36px; }
  .bs-hq-layout__brand h1 { font-size: 18px; }
  .bs-hq-layout__navigation { top: 64px; width: calc(100% - 24px); max-width: 360px; padding: 3px; }
  .bs-hq-layout .bs-hq-layout__tab { flex: 1; padding: 7px 6px; font-size: 11px; }
  .bs-hq-layout__session { inset-block-start: 122px; inset-inline-end: 12px; width: 172px; padding: 8px; gap: 6px; border-radius: 13px; }
  .bs-hq-layout__status { font-size: 10px; }
  .bs-hq-layout .bs-hq-layout__ceo, .bs-hq-layout .bs-hq-layout__login { font-size: 11px; }
  .bs-hq-layout__brain-panel { inset-block-start: 116px; }
  .bs-hq-layout__footer { padding: 12px; gap: 10px; }
  .bs-hq-layout__workspace-info { max-width: 160px; }
  .bs-hq-layout__gesture-hint { font-size: 9px; }
  .bs-hq-layout__keyboard-hint { display: none; }
  .bs-hq-layout__view { gap: 8px; }
  .bs-hq-layout__minimap { width: 88px; height: 88px; }
  .bs-hq-layout__zoom { grid-template-columns: repeat(3, 32px); }
  .bs-hq-layout .bs-hq-layout__zoom button { width: 32px; height: 32px; border-radius: 9px; }
}
@media (max-width: 374px) {
  .bs-hq-layout__workspace-info { max-width: 120px; }
  .bs-hq-layout__gesture-hint { display: none; }
  .bs-hq-layout__minimap { width: 80px; height: 80px; }
}
@media (max-height: 500px) and (min-width: 521px) {
  .bs-hq-layout__brand { inset-block-start: 12px; }
  .bs-hq-layout__navigation { top: 12px; }
  .bs-hq-layout__brand h1 { font-size: 16px; }
  .bs-hq-layout__session { inset-block-start: 72px; width: 180px; }
  .bs-hq-layout__brain-panel { inset-block-start: 72px; }
  .bs-hq-layout__gesture-hint { display: none; }
}
@media (max-height: 500px) and (min-width: 521px) and (max-width: 760px) {
  .bs-hq-layout__brand h1 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
}
@media (pointer: coarse) {
  .bs-hq-layout__mouse-hint { display: none; }
  .bs-hq-layout__touch-hint { display: inline; }
  .bs-hq-layout__keyboard-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) { .bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: none; } }
</style>
