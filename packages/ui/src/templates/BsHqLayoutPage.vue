<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'
import { SPATIAL_VIEWPORT_DEFAULT_CAMERA, useSpatialViewport } from '@building-suit/ux'
import type { SpatialViewportCamera } from '@building-suit/ux'
import type { HqBrainPresentation, HqLayoutContent } from '../types/hqLayoutPresentation'

const props = defineProps<{ content: HqLayoutContent; brain?: HqBrainPresentation }>()
const emit = defineEmits<{ refreshBrain: []; selectBrainNote: [id: string] }>()
const sceneRef = shallowRef<{ activateAt: (x: number, y: number) => boolean; setExcitedAt: (x: number, y: number, active: boolean) => boolean } | null>(null)
const brainVisible = ref(false)
const brainPanelPresent = ref(false)
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
const hintId = useId()
const brainPanelId = useId()
const brainTitleId = useId()
const orbMarker = computed(() => ({
  left: `${Math.max(9, Math.min(91, 50 - camera.panX * 9))}%`,
  top: `${Math.max(12, Math.min(88, 50 + camera.panY * 11))}%`,
}))
const viewMarker = computed(() => ({
  width: `${Math.min(94, 62 / camera.zoom)}%`,
  height: `${Math.min(90, 62 / camera.zoom)}%`,
  transform: `translate(-50%, -50%) rotate(${(camera.yaw - SPATIAL_VIEWPORT_DEFAULT_CAMERA.yaw) * 180 / Math.PI}deg)`,
}))
</script>

<template>
  <div class="bs-hq-layout">
    <header class="bs-hq-layout__header">
      <div class="bs-hq-layout__brand">
        <img :src="content.logoSrc" alt="" width="40" height="54">
        <h1>{{ content.brandName }} <span>{{ content.brandSuffix }}</span></h1>
      </div>

      <nav class="bs-hq-layout__navigation" :aria-label="content.workspaceLabel">
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': !brainVisible }" :aria-current="!brainVisible ? 'page' : undefined" @click="closeBrain()">{{ content.workspaceLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.tasksLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': brainVisible }" :aria-controls="brainPanelId" :aria-expanded="brainVisible" @click="openBrain">{{ content.brainLabel }}</BsButton>
      </nav>

      <div class="bs-hq-layout__actions">
        <span class="bs-hq-layout__status"><span aria-hidden="true" />{{ content.statusLabel }}</span>
        <BsButton variant="accent" class="bs-hq-layout__ceo" disabled><BsIcon name="chat" :size="20" />{{ content.talkToCeoLabel }}</BsButton>
        <BsButton variant="icon" class="bs-hq-layout__profile" :aria-label="content.profileLabel" disabled><BsIcon name="user" :size="26" /></BsButton>
      </div>
    </header>

    <main class="bs-hq-layout__workspace-area" :class="{ 'bs-hq-layout__workspace-area--brain': brainVisible }" @keydown="onWorkspaceKeydown">
    <section ref="viewportRef" class="bs-hq-layout__canvas" :class="{ 'bs-hq-layout__canvas--interacting': isInteracting }" :aria-label="content.canvasLabel" :aria-describedby="hintId" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="onPointerLeave" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd" @wheel="onWheel" @auxclick.prevent @contextmenu.prevent>
      <BsHologramScene ref="sceneRef" :camera="camera" :opened="brainVisible" :reset-version="resetVersion" :label="content.hologramLabel" :unavailable-label="content.sceneUnavailableLabel" @activate="openBrain" />
      <div class="bs-hq-layout__brain-entry" data-spatial-controls>
        <BsButton variant="text" class="bs-hq-layout__brain-button" :aria-controls="brainPanelId" :aria-expanded="brainVisible" :aria-label="brainCopy.openLabel" @click="openBrain"><BsIcon name="orb" :size="22" /><span><strong>{{ brainCopy.title }}</strong><small :data-status="brainStatus">{{ brainStatusLabel }}</small></span></BsButton>
      </div>
      <div class="bs-hq-layout__footer" dir="ltr">
        <div class="bs-hq-layout__workspace-info" dir="auto">
          <span class="bs-hq-layout__workspace"><BsIcon name="cube" :size="22" />{{ content.workspaceLabel }}</span>
          <p :id="hintId" class="bs-hq-layout__gesture-hint"><span class="bs-hq-layout__mouse-hint">{{ content.mouseControlsLabel }}</span><span class="bs-hq-layout__touch-hint">{{ content.touchControlsLabel }}</span><span class="bs-hq-layout__keyboard-hint">{{ content.keyboardControlsLabel }}</span></p>
        </div>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel" data-spatial-controls>
          <span class="bs-hq-layout__zoom-value" :aria-label="content.zoomLabel">{{ zoomPercent }}%</span>
          <div class="bs-hq-layout__minimap" role="img" :aria-label="content.hologramLabel">
            <span class="bs-hq-layout__minimap-view" :style="viewMarker" aria-hidden="true" />
            <span class="bs-hq-layout__orb-marker" :style="orbMarker" aria-hidden="true"><BsIcon name="orb" :size="21" /></span>
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
  flex-direction: column;
  height: 100svh;
  min-height: 360px;
  padding: 0 8px 8px;
  overflow: hidden;
  color: var(--bs-pearl-white);
  background: linear-gradient(120deg, color-mix(in srgb, var(--bs-navy-surface) 45%, var(--bs-color-gray-900)), var(--bs-midnight-background));
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 18%, transparent);
  border-radius: 26px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--bs-pearl-white) 8%, transparent);
  font-family: var(--bs-font-latin);
}
.bs-hq-layout__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  min-height: 70px;
  padding-inline: 44px 6px;
}
.bs-hq-layout__brand { display: flex; align-items: center; gap: 21px; white-space: nowrap; }
.bs-hq-layout__brand img { flex: none; width: 40px; height: 54px; object-fit: contain; }
.bs-hq-layout__brand h1 { margin: 0; font-size: 27px; font-weight: 750; line-height: 1.2; letter-spacing: -.8px; }
.bs-hq-layout__brand h1 span { color: var(--bs-highlight-gold); }
.bs-hq-layout__navigation {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 5%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--bs-midnight-background) 74%, transparent);
}
.bs-hq-layout .bs-hq-layout__tab {
  min-width: 94px;
  min-height: 39px;
  padding: 8px 17px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--bs-cloud-gray);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}
.bs-hq-layout .bs-hq-layout__tab--selected {
  background: linear-gradient(var(--bs-steel-border), color-mix(in srgb, var(--bs-cloud-gray) 15%, var(--bs-midnight-background)));
  border-color: color-mix(in srgb, var(--bs-cloud-gray) 14%, transparent);
  box-shadow: 0 2px 5px color-mix(in srgb, var(--bs-midnight-background) 70%, transparent), inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 7%, transparent);
  color: var(--bs-pearl-white);
  font-weight: 650;
}
.bs-hq-layout__actions { display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
.bs-hq-layout__workspace-area { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); flex: 1; min-height: 0; overflow: hidden; }
.bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(-100% - var(--bs-space-3)); position: absolute; z-index: 3; inset-block: var(--bs-space-3); inset-inline-start: var(--bs-space-3); width: min(420px, calc(100% - var(--bs-space-6))); display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; padding: var(--bs-space-5); border: 1px solid var(--bs-steel-border); border-radius: var(--bs-radius-modal); color: var(--bs-pearl-white); background: var(--bs-color-neutral-charcoal); box-shadow: var(--bs-shadow-elevation3-dark); user-select: text; }
:global([dir="rtl"]) .bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(100% + var(--bs-space-3)); }
.bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: transform 280ms cubic-bezier(.22, 1, .36, 1), opacity 200ms ease; will-change: transform; }
.bs-hq-brain-slide-enter-from, .bs-hq-brain-slide-leave-to { transform: translateX(var(--bs-brain-panel-offset)); opacity: 0; }
.bs-hq-layout__brain-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); margin-bottom: var(--bs-space-5); }
.bs-hq-layout__brain-heading h2 { margin: 0; font-size: 19px; font-weight: 650; }
.bs-hq-layout__brain-heading h2:focus { outline: none; }
.bs-hq-layout__brain-heading button { flex: none; color: var(--bs-cloud-gray); }
.bs-hq-layout__brain-panel button:focus-visible, .bs-hq-layout__brain-panel input:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 8px 17px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 13%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bs-navy-surface) 35%, transparent);
  color: var(--bs-cloud-gray);
  font-size: 13px;
  white-space: nowrap;
}
.bs-hq-layout__status > span { width: 9px; height: 9px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-layout .bs-hq-layout__ceo {
  display: inline-flex;
  gap: 9px;
  min-height: 40px;
  padding: 9px 18px;
  border: 1px solid var(--bs-premium-gold);
  border-radius: 12px;
  background: linear-gradient(var(--bs-color-gold-300), var(--bs-premium-gold));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 35%, transparent), 0 0 20px color-mix(in srgb, var(--bs-premium-gold) 12%, transparent);
  color: var(--bs-deep-structure-navy);
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}
.bs-hq-layout .bs-hq-layout__profile {
  width: 43px;
  height: 43px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 7%, transparent);
  border-radius: 50%;
  color: var(--bs-cloud-gray);
  background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 16%, var(--bs-midnight-background)), color-mix(in srgb, var(--bs-cloud-gray) 6%, var(--bs-midnight-background)));
}
.bs-hq-layout__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 16%, transparent);
  border-radius: 26px 26px 21px 21px;
  background:
    radial-gradient(ellipse at 9% 37%, color-mix(in srgb, var(--bs-color-secondary-slate-blue) 46%, transparent), transparent 70%),
    linear-gradient(115deg, color-mix(in srgb, var(--bs-color-gray-700) 65%, var(--bs-navy-surface)), color-mix(in srgb, var(--bs-color-gray-900) 70%, var(--bs-navy-surface)));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 4%, transparent);
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.bs-hq-layout__canvas--interacting { cursor: grabbing; }
.bs-hq-layout__canvas:focus-visible { outline: 2px solid var(--bs-sky-steel); outline-offset: -4px; }
.bs-hq-layout__brain-entry { position: absolute; top: 18px; inset-inline-start: 18px; cursor: default; }
.bs-hq-layout .bs-hq-layout__brain-button { display: flex; align-items: center; gap: 12px; padding: 10px 15px; border: 1px solid color-mix(in srgb, var(--bs-sky-steel) 35%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--bs-midnight-background) 85%, transparent); color: var(--bs-pearl-white); }
.bs-hq-layout__brain-button span { display: grid; gap: 3px; text-align: start; }
.bs-hq-layout__brain-button strong { font-size: 13px; }
.bs-hq-layout__brain-button small { color: var(--bs-cloud-gray); font-size: 11px; }
.bs-hq-layout__brain-button small[data-status="connected"] { color: var(--bs-color-secondary-pale-sky); }
.bs-hq-layout__tab:not(:disabled), .bs-hq-layout__brain-button { cursor: pointer; }
.bs-hq-layout__tab:focus-visible, .bs-hq-layout__brain-button:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-brain { display: grid; gap: var(--bs-space-4); }
.bs-hq-brain__source { display: flex; align-items: start; justify-content: space-between; gap: var(--bs-space-4); }
.bs-hq-brain__source { flex-wrap: wrap; font-size: 13px; line-height: 1.6; padding-bottom: var(--bs-space-4); border-bottom: 1px solid var(--bs-color-gray-800); }
.bs-hq-brain__source p { margin: var(--bs-space-2) 0; color: var(--bs-cloud-gray); font-size: 12px; }
.bs-hq-brain small { color: var(--bs-cloud-gray); font-size: 11px; }
.bs-hq-brain__body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-5); }
.bs-hq-brain__directory { min-width: 0; }
.bs-hq-brain__directory input { color: var(--bs-pearl-white); background: var(--bs-color-neutral-graphite); border-color: var(--bs-steel-border); }
.bs-hq-brain__directory input::placeholder { color: var(--bs-color-gray-400); }
.bs-hq-brain__directory ul { display: grid; gap: var(--bs-space-1); padding: 0; margin: var(--bs-space-3) 0 0; list-style: none; max-height: 29dvh; overflow: auto; overscroll-behavior: contain; }
.bs-hq-brain__directory button { display: grid; width: 100%; min-width: 0; gap: var(--bs-space-1); padding: var(--bs-space-3); text-align: start; }
.bs-hq-brain__directory strong { font-size: 13px; font-weight: 600; }
.bs-hq-brain__directory small { overflow-wrap: anywhere; }
.bs-hq-brain__directory button { color: var(--bs-pearl-white); }
.bs-hq-brain__directory button:hover { background: var(--bs-color-neutral-graphite); }
.bs-hq-brain__directory button[aria-pressed="true"] { background: var(--bs-color-neutral-graphite); border-inline-start: 2px solid var(--bs-premium-gold); }
.bs-hq-brain__note { min-width: 0; padding-top: var(--bs-space-4); border-top: 1px solid var(--bs-color-gray-800); user-select: text; }
.bs-hq-brain__note h2 { margin: 0 0 var(--bs-space-2); font-size: 18px; }
.bs-hq-brain__note p { margin: var(--bs-space-2) 0; overflow-wrap: anywhere; }
.bs-hq-brain__note pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; line-height: 1.8; unicode-bidi: plaintext; }
@media (max-width: 840px) {
  .bs-hq-layout__brain-panel { inset-block-end: 84px; padding: var(--bs-space-4); }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__workspace-info { display: none; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__view { width: 140px; padding-top: 26px; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__minimap { display: none; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { padding: 10px; justify-content: flex-end; }
  .bs-hq-brain__directory ul { max-height: 23dvh; }
}
@media (prefers-reduced-motion: reduce) { .bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: none; } }
.bs-hq-layout__footer { position: absolute; inset: auto 0 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 20px; pointer-events: none; }
.bs-hq-layout__workspace-info { display: grid; min-width: 0; justify-items: start; gap: 10px; }
.bs-hq-layout__gesture-hint { max-width: 450px; margin: 0; color: var(--bs-cloud-gray); opacity: 0.7; font-size: 11px; line-height: 1.6; }
.bs-hq-layout__touch-hint { display: none; }
.bs-hq-layout__keyboard-hint { display: block; }
.bs-hq-layout__workspace {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-height: 42px;
  padding: 9px 15px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 22%, transparent);
  border-radius: 12px;
  background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 8%, var(--bs-midnight-background)), var(--bs-midnight-background));
  box-shadow: 0 3px 12px color-mix(in srgb, var(--bs-midnight-background) 25%, transparent);
  color: var(--bs-soft-silver);
  font-size: 14px;
  font-weight: 550;
}
.bs-hq-layout__view { position: relative; flex: none; width: 218px; padding: 29px 14px 11px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 24%, transparent); border-radius: 19px; background: color-mix(in srgb, var(--bs-midnight-background) 75%, transparent); box-shadow: 0 5px 20px color-mix(in srgb, var(--bs-midnight-background) 25%, transparent); pointer-events: auto; cursor: default; }
.bs-hq-layout__zoom-value { position: absolute; top: 7px; right: 17px; color: var(--bs-cloud-gray); font-size: 10px; font-variant-numeric: tabular-nums; }
.bs-hq-layout__minimap { position: relative; height: 91px; margin: 0 10px 23px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 25%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--bs-midnight-background) 55%, transparent); }
.bs-hq-layout__minimap-view { position: absolute; top: 50%; left: 50%; border: 1px solid color-mix(in srgb, var(--bs-sky-steel) 30%, transparent); background: color-mix(in srgb, var(--bs-sky-steel) 5%, transparent); border-radius: 3px; }
.bs-hq-layout__orb-marker { position: absolute; display: grid; place-items: center; width: 30px; height: 30px; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, var(--bs-color-secondary-pale-sky) 40%, transparent); border-radius: 50%; color: var(--bs-color-secondary-pale-sky); background: color-mix(in srgb, var(--bs-sky-steel) 22%, var(--bs-midnight-background)); box-shadow: 0 0 19px color-mix(in srgb, var(--bs-sky-steel) 25%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 100%; min-width: 0; height: 44px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 12%, transparent); border-radius: 10px; background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 16%, var(--bs-midnight-background)), color-mix(in srgb, var(--bs-cloud-gray) 8%, var(--bs-midnight-background))); color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled) { cursor: pointer; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled):hover { border-color: var(--bs-sky-steel); color: var(--bs-pearl-white); }
.bs-hq-layout .bs-hq-layout__zoom button:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout .bs-hq-layout__zoom button:disabled { opacity: 0.4; }
:global([dir="rtl"]) .bs-hq-layout { font-family: var(--bs-font-arabic); }
:global([dir="rtl"]) .bs-hq-layout__brand h1 { letter-spacing: normal; }
:global([dir="rtl"]) .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { flex-direction: row-reverse; }
@media (max-width: 1279px) {
  .bs-hq-layout__header { padding-inline: 14px 6px; gap: 16px; }
  .bs-hq-layout__brand { gap: 12px; }
  .bs-hq-layout__brand h1 { font-size: 22px; }
  .bs-hq-layout__actions { gap: 10px; }
  .bs-hq-layout__status { padding-inline: 10px; font-size: 12px; }
  .bs-hq-layout .bs-hq-layout__tab { min-width: 77px; padding-inline: 12px; font-size: 14px; }
}
@media (max-width: 1023px) {
  .bs-hq-layout__header { grid-template-columns: 1fr auto; padding-block: 10px; gap: 10px 16px; }
  .bs-hq-layout__navigation { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
  .bs-hq-layout__status { display: none; }
}
@media (max-width: 520px) {
  .bs-hq-layout { padding: 0 5px 5px; border-radius: 19px; }
  .bs-hq-layout__header { padding-inline: 7px; gap: 10px; }
  .bs-hq-layout__brand { gap: 9px; }
  .bs-hq-layout__brand img { width: 28px; height: 40px; }
  .bs-hq-layout__brand h1 { font-size: 17px; letter-spacing: -.5px; }
  .bs-hq-layout__actions { gap: 7px; }
  .bs-hq-layout .bs-hq-layout__ceo { max-width: 128px; padding-inline: 10px; font-size: 11px; gap: 5px; min-height: 35px; white-space: normal; line-height: 1.25; }
  .bs-hq-layout .bs-hq-layout__ceo svg { width: 16px; }
  .bs-hq-layout .bs-hq-layout__profile { width: 34px; height: 34px; }
  .bs-hq-layout .bs-hq-layout__profile svg { width: 22px; }
  .bs-hq-layout__canvas { border-radius: 19px 19px 15px 15px; }
  .bs-hq-layout__footer { padding: 12px; gap: 10px; }
  .bs-hq-layout__workspace { padding-inline: 10px; font-size: 12px; gap: 6px; }
  .bs-hq-layout__workspace-info { max-width: 165px; gap: 8px; }
  .bs-hq-layout__gesture-hint { font-size: 10px; }
  .bs-hq-layout__keyboard-hint { display: none; }
  .bs-hq-layout__view { width: 164px; padding: 27px 9px 9px; border-radius: 13px; }
  .bs-hq-layout__minimap { height: 60px; margin: 0 4px 13px; }
  .bs-hq-layout__zoom { gap: 5px; }
  .bs-hq-layout .bs-hq-layout__zoom button { border-radius: 7px; }
}
@media (max-width: 374px) {
  .bs-hq-layout .bs-hq-layout__ceo { display: none; }
  .bs-hq-layout__workspace-info { max-width: 110px; }
  .bs-hq-layout__footer { padding: 10px; }
}
@media (pointer: coarse) {
  .bs-hq-layout__mouse-hint { display: none; }
  .bs-hq-layout__touch-hint { display: inline; }
  .bs-hq-layout__keyboard-hint { display: none; }
}
</style>
