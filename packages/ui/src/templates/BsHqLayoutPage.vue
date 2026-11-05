<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, shallowRef, useId, watch } from 'vue'
import { SPATIAL_VIEWPORT_GROUND_Y, spatialViewportFrame, spatialViewportGroundFootprint, spatialViewportScreenRectangle, useSpatialViewport, useSpatialWorkspaceSelection } from '@building-suit/ux'
import type { HqBrainPresentation, HqCompanyPlansPresentation, HqDepartmentOffice, HqFounderAccessPresentation, HqLayoutContent, HqUserPresentation } from '../types/hqLayoutPresentation'
import { hologramFloorRadius } from '../utils/hologramScene'
import { layoutDepartmentOffices, workplaceFootprint } from '../utils/departmentOfficeLayout.ts'
import type { OfficePlacement } from '../utils/departmentOfficeLayout.ts'
import { createHqIslandFootprint } from '../utils/hqIslandGeometry.ts'

const props = defineProps<{ content: HqLayoutContent; brain?: HqBrainPresentation; user?: HqUserPresentation; officeLayerCount?: number; access?: HqFounderAccessPresentation; companyPlans?: HqCompanyPlansPresentation; departments?: readonly HqDepartmentOffice[] }>()
const emit = defineEmits<{ refreshBrain: []; selectBrainNote: [id: string]; login: [email: string, password: string]; register: [email: string, password: string]; logout: []; refreshPlans: []; decidePlan: [id: string, revision: number, decision: 'approved' | 'rejected'] }>()
const sceneRef = shallowRef<{ activateAt: (x: number, y: number) => boolean; setExcitedAt: (x: number, y: number, active: boolean) => boolean } | null>(null)
const brainPanelPresent = ref(false)
const workplacePanelPresent = ref(false)
const workplaceTitleRef = shallowRef<HTMLElement | null>(null)
const workplaceSelectRef = shallowRef<{ focus: () => void } | null>(null)
const officeLayout = computed(() => layoutDepartmentOffices(props.departments ?? []))
const islandFootprint = computed(() => createHqIslandFootprint(officeLayout.value))
const floorRadius = computed(() => Math.max(officeLayout.value.floorRadius, islandFootprint.value.radius, hologramFloorRadius(props.officeLayerCount)))
const availableWorkplaces = computed(() => [
  { ...officeLayout.value.executive, name: props.content.companyPlans.executiveLabel, executive: true },
  ...officeLayout.value.offices.map(office => ({ ...office, executive: false })),
])
const workplaceOptions = computed(() => availableWorkplaces.value.map(({ id, name }) => ({ id, name })))
const founderAccess = computed<HqFounderAccessPresentation>(() => props.access ?? { status: 'anonymous', pending: false })
const plansWorkspace = computed<HqCompanyPlansPresentation>(() => props.companyPlans ?? { status: 'unavailable', pending: false, plans: [] })
const displayedUser = computed(() => founderAccess.value.user ?? props.user)
const orbHovered = ref(false)
const feedback = (x: number, y: number, active: boolean) => { sceneRef.value?.setExcitedAt(x, y, active) }
const { viewportRef, camera, resetVersion, isInteracting, zoomPercent, canZoomIn, canZoomOut, onPointerDown, onPointerMove, onPointerEnd, onPointerLeave, onWheel, onKeydown, zoomBy, reset, transitionTo } = useSpatialViewport((x, y) => sceneRef.value?.activateAt(x, y), { onHover: feedback, onHold: feedback }, { zoomLocked: () => Boolean(focusedTargetId.value) || brainPanelPresent.value || workplacePanelPresent.value, sceneRadius: () => floorRadius.value })
const viewportSize = shallowRef({ width: 1, height: 1 })
const { selectedId: focusedTargetId, select: focusTarget, clear: clearFocus, refit: refitFocus } = useSpatialWorkspaceSelection({
  camera, viewport: () => viewportSize.value, sceneRadius: () => floorRadius.value,
  overlayWidth: () => Math.min(420, Math.max(0, viewportSize.value.width - 24)) + 24,
  rtl: () => typeof window !== 'undefined' && Boolean(viewportRef.value) && getComputedStyle(viewportRef.value!).direction === 'rtl',
  transitionTo,
})
const brainVisible = computed(() => focusedTargetId.value === 'brain')
const selectedWorkplaceId = computed(() => focusedTargetId.value?.startsWith('workplace:') ? focusedTargetId.value.slice(10) : null)
const selectedWorkplace = computed(() => availableWorkplaces.value.find(workplace => workplace.id === selectedWorkplaceId.value) ?? null)
const workplaceVisible = computed(() => Boolean(selectedWorkplace.value))
const plansVisible = computed(() => Boolean(selectedWorkplace.value?.executive))
watch([viewportSize, floorRadius], () => refitFocus())
let viewportObserver: ResizeObserver | undefined
watch(viewportRef, element => {
  viewportObserver?.disconnect()
  viewportObserver = undefined
  if (!element) return
  const measure = () => {
    const width = element.clientWidth, height = element.clientHeight
    if (width > 0 && height > 0 && (width !== viewportSize.value.width || height !== viewportSize.value.height)) viewportSize.value = { width, height }
  }
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    viewportObserver = new ResizeObserver(measure)
    viewportObserver.observe(element)
  }
}, { flush: 'post' })
onScopeDispose(() => { viewportObserver?.disconnect() })
const panelTitleRef = shallowRef<HTMLElement | null>(null)
const ui = useUiCopy()
let returnFocus: HTMLElement | null = null
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
  emit('refreshBrain')
  rememberReturnFocus()
  brainPanelPresent.value = true
  focusTarget({ id: 'brain', x: 0, z: 0, width: 1.8, depth: 1.8, height: 2, yaw: 0, viewYaw: 0.35, pitch: 0.2, distance: 5 })
  await nextTick()
  if (brainVisible.value) panelTitleRef.value?.focus({ preventScroll: true })
}
function rememberReturnFocus() {
  if (focusedTargetId.value || typeof document === 'undefined') return
  const active = document.activeElement
  returnFocus = active instanceof HTMLElement && active !== document.body && active !== document.documentElement ? active : viewportRef.value
}
function closeSelection(restoreCamera = true) {
  if (!clearFocus(restoreCamera)) return
  if (returnFocus?.isConnected && returnFocus.getClientRects().length && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true })
  else if (restoreCamera) workplaceSelectRef.value?.focus()
  else viewportRef.value?.focus({ preventScroll: true })
  returnFocus = null
}
function closeBrain(restoreCamera = true) { if (brainVisible.value) closeSelection(restoreCamera) }
async function openWorkplace(id: string) {
  const workplace = availableWorkplaces.value.find(item => item.id === id)
  if (!workplace) return
  rememberReturnFocus()
  workplacePanelPresent.value = true
  focusTarget(workplaceTarget(workplace))
  await nextTick()
  if (selectedWorkplaceId.value === id) workplaceTitleRef.value?.focus({ preventScroll: true })
}
function workplaceTarget(workplace: OfficePlacement & { id: string }) {
  const cosine = Math.cos(workplace.yaw), sine = Math.sin(workplace.yaw)
  const localPoints = workplaceFootprint(workplace).map(point => {
    const x = point.x - workplace.x, z = point.z - workplace.z
    return { x: cosine * x - sine * z, z: sine * x + cosine * z }
  })
  const minX = Math.min(...localPoints.map(point => point.x)), maxX = Math.max(...localPoints.map(point => point.x))
  const minZ = Math.min(...localPoints.map(point => point.z)), maxZ = Math.max(...localPoints.map(point => point.z))
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2
  return {
    id: `workplace:${workplace.id}`,
    x: workplace.x + cosine * centerX + sine * centerZ,
    z: workplace.z - sine * centerX + cosine * centerZ,
    width: maxX - minX, depth: maxZ - minZ,
    height: 1.9, bottom: SPATIAL_VIEWPORT_GROUND_Y + 0.14, yaw: workplace.yaw,
  }
}
function chooseWorkplace(value: string | number | null) {
  if (typeof value === 'string') void openWorkplace(value)
  else closeSelection()
}
function openPlans() { void openWorkplace(officeLayout.value.executive.id) }
function showWorkspace() { closeSelection() }
function resetScene() { closeSelection(false); reset() }
function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && focusedTargetId.value) { event.preventDefault(); closeSelection(); return }
  // Notes retain native scrolling/navigation; manual camera zoom is locked
  // centrally while this panel is open, including shortcuts on the canvas.
  if (event.target instanceof Element && event.target.closest('.bs-hq-layout__brain-panel')) return
  onKeydown(event)
}
watch(resetVersion, () => closeSelection(false))
watch(() => founderAccess.value.status, (status, previous) => {
  if (previous === 'founder' && status !== 'founder' && selectedWorkplaceId.value) closeSelection()
})
watch(() => availableWorkplaces.value.map(({ id, x, z, width, depth, yaw, sector }) => [id, x, z, width, depth, yaw, sector.startAngle, sector.endAngle, sector.innerRadius, sector.outerRadius].join(',')).join(';'), () => {
  if (!selectedWorkplaceId.value) return
  if (selectedWorkplace.value) focusTarget(workplaceTarget(selectedWorkplace.value))
  else closeSelection()
})
const userInitials = computed(() => displayedUser.value?.displayName.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('') ?? '')
const mapScale = computed(() => 45 / floorRadius.value)
const hintId = useId()
const islandClipId = useId()
const brainPanelId = useId()
const brainTitleId = useId()
const workplacePanelId = useId()
const workplaceTitleId = useId()
const mapPolygon = (points: readonly { x: number; z: number }[]) => points.map(point => `${(50 + point.x * mapScale.value).toFixed(3)},${(50 + point.z * mapScale.value).toFixed(3)}`).join(' ')
const islandMapOutline = computed(() => mapPolygon(islandFootprint.value.outline))
const officeFootprint = (office: OfficePlacement) => mapPolygon(workplaceFootprint(office))
const mapOffices = computed(() => [
  { id: officeLayout.value.executive.id, name: props.content.companyPlans.executiveLabel, executive: true, points: officeFootprint(officeLayout.value.executive), road: mapPolygon(officeLayout.value.executive.roadPoints) },
  ...officeLayout.value.offices.map(office => ({ id: office.id, name: office.name, executive: false, points: officeFootprint(office), road: mapPolygon(office.roadPoints) })),
])
const viewportFrame = computed(() => spatialViewportFrame(camera, viewportSize.value.width, viewportSize.value.height, floorRadius.value))
const groundFootprint = computed(() => mapPolygon(spatialViewportGroundFootprint(viewportFrame.value, floorRadius.value)))
// This outline preserves the screen aspect at the focus distance. The filled
// polygon separately shows the oblique frustum's actual finite-floor footprint.
const screenRectangle = computed(() => mapPolygon(spatialViewportScreenRectangle(viewportFrame.value)))
</script>

<template>
  <div class="bs-hq-layout">
    <main class="bs-hq-layout__workspace-area" :class="{ 'bs-hq-layout__workspace-area--brain': brainVisible || workplaceVisible }" @keydown="onWorkspaceKeydown">
    <section ref="viewportRef" class="bs-hq-layout__canvas" :class="{ 'bs-hq-layout__canvas--interacting': isInteracting, 'bs-hq-layout__canvas--orb-hovered': orbHovered }" :aria-label="content.canvasLabel" :aria-describedby="hintId" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="onPointerLeave" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd" @wheel="onWheel" @auxclick.prevent @contextmenu.prevent>
      <BsHologramScene ref="sceneRef" :camera="camera" :departments="departments" :executive-label="content.companyPlans.executiveLabel" :selected-workplace-id="selectedWorkplaceId" :office-layer-count="officeLayerCount" :opened="brainVisible" :reset-version="resetVersion" :label="content.hologramLabel" :unavailable-label="content.sceneUnavailableLabel" @activate="openBrain" @select-workplace="openWorkplace" @hover-change="orbHovered = $event" />
      <div class="bs-hq-layout__brand" data-spatial-controls>
        <img :src="content.logoSrc" alt="" width="32" height="44">
        <h1>{{ content.brandName }} <span>{{ content.brandSuffix }}</span></h1>
      </div>
      <nav class="bs-hq-layout__navigation" :aria-label="content.workspaceLabel" data-spatial-controls>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': !focusedTargetId }" :aria-current="!focusedTargetId ? 'page' : undefined" @click="showWorkspace">{{ content.workspaceLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.tasksLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.calendarLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': brainVisible }" :aria-label="brainCopy.openLabel" :aria-controls="brainPanelId" :aria-expanded="brainVisible" @click="openBrain">{{ content.brainLabel }}</BsButton>
        <div class="bs-hq-layout__workplace-picker" :class="{ 'bs-hq-layout__workplace-picker--selected': selectedWorkplace }">
          <BsSelect ref="workplaceSelectRef" :model-value="selectedWorkplaceId" :options="workplaceOptions" option-label="name" option-value="id" :label="content.workplaces.label" :placeholder="content.workplaces.label" :title="selectedWorkplace?.name ?? content.workplaces.label" append-to="self" scroll-height="clamp(88px, calc(100dvh - 210px), 224px)" @update:model-value="chooseWorkplace" @keydown.esc.stop />
          <BsButton v-if="selectedWorkplace" variant="icon" class="bs-hq-layout__workplace-clear" :aria-label="`${content.workplaces.clearSelectionLabel}: ${selectedWorkplace.name}`" :title="content.workplaces.clearSelectionLabel" @click="closeSelection()"><BsIcon name="close" :size="16" /></BsButton>
        </div>
      </nav>
      <aside class="bs-hq-layout__session" data-spatial-controls>
        <span class="bs-hq-layout__status"><span aria-hidden="true" />{{ content.statusLabel }}</span>
        <BsButton variant="accent" class="bs-hq-layout__ceo" disabled><BsIcon name="chat" :size="17" />{{ content.talkToCeoLabel }}</BsButton>
        <BsButton v-if="displayedUser" variant="text" class="bs-hq-layout__account" :aria-label="content.companyPlans.executiveLabel" :aria-controls="workplacePanelId" :aria-expanded="plansVisible" @click="openPlans">
          <span class="bs-hq-layout__avatar"><img v-if="displayedUser.avatarUrl" :src="displayedUser.avatarUrl" alt="" width="30" height="30"><span v-else>{{ userInitials }}</span></span>
          <span class="bs-hq-layout__identity"><strong>{{ displayedUser.displayName }}</strong><small v-if="displayedUser.detailLabel">{{ displayedUser.detailLabel }}</small></span>
        </BsButton>
        <BsButton v-else variant="text" class="bs-hq-layout__login" :disabled="founderAccess.pending" :aria-controls="workplacePanelId" :aria-expanded="plansVisible" @click="openPlans"><BsIcon name="user" :size="18" />{{ content.loginLabel }}</BsButton>
        <BsButton v-if="founderAccess.status === 'founder'" variant="text" class="bs-hq-layout__login" :disabled="founderAccess.pending" @click="emit('logout')">{{ content.companyPlans.signOutLabel }}</BsButton>
      </aside>
      <div class="bs-hq-layout__footer" dir="ltr">
        <div class="bs-hq-layout__workspace-info" dir="auto">
          <p :id="hintId" class="bs-hq-layout__gesture-hint"><span class="bs-hq-layout__mouse-hint">{{ content.mouseControlsLabel }}</span><span class="bs-hq-layout__touch-hint">{{ content.touchControlsLabel }}</span><span class="bs-hq-layout__keyboard-hint">{{ content.keyboardControlsLabel }}</span></p>
        </div>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel" data-spatial-controls>
          <div class="bs-hq-layout__minimap" role="img" :aria-label="`${content.minimapLabel}, ${content.zoomLabel}: ${zoomPercent}%`">
            <svg class="bs-hq-layout__minimap-scene" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <defs><clipPath :id="islandClipId"><polygon :points="islandMapOutline" /></clipPath></defs>
              <polygon class="bs-hq-layout__map-floor" :points="islandMapOutline" />
              <polygon v-if="groundFootprint" class="bs-hq-layout__map-footprint" :points="groundFootprint" :clip-path="`url(#${islandClipId})`" />
              <polyline v-for="office in mapOffices" :key="`${office.id}-road`" class="bs-hq-layout__map-road" :points="office.road" />
              <polygon v-for="office in mapOffices" :key="office.id" class="bs-hq-layout__office-marker" :class="{ 'bs-hq-layout__office-marker--executive': office.executive, 'bs-hq-layout__office-marker--selected': selectedWorkplaceId === office.id }" :points="office.points"><title>{{ office.name }}</title></polygon>
              <polygon class="bs-hq-layout__minimap-view" :points="screenRectangle" />
            </svg>
            <span class="bs-hq-layout__orb-marker" style="left: 50%; top: 50%" aria-hidden="true"><BsIcon name="orb" :size="18" /></span>
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
    <Transition name="bs-hq-brain-slide" @after-leave="brainPanelPresent = brainVisible">
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
    <Transition name="bs-hq-brain-slide" @after-leave="workplacePanelPresent = workplaceVisible">
      <aside v-if="selectedWorkplace" :id="workplacePanelId" class="bs-hq-layout__brain-panel bs-hq-layout__workplace-panel" :aria-labelledby="workplaceTitleId" @wheel.stop @keydown.esc.stop.prevent="closeSelection()">
        <header class="bs-hq-layout__brain-heading">
          <h2 :id="workplaceTitleId" ref="workplaceTitleRef" tabindex="-1">{{ selectedWorkplace.name }}</h2>
          <BsButton variant="icon" :aria-label="ui('close')" @click="closeSelection()"><BsIcon name="close" :size="20" /></BsButton>
        </header>
        <p class="bs-hq-layout__workplace-description">{{ selectedWorkplace.executive ? content.workplaces.executiveDescription : content.workplaces.departmentDescription }}</p>
        <template v-if="selectedWorkplace.executive">
          <h3 class="bs-hq-layout__workplace-subheading">{{ content.workplaces.plansLabel }}</h3>
          <BsHqCompanyPlans :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" :departments="departments" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" @logout="emit('logout')" @refresh="emit('refreshPlans')" @decision="(id, revision, decision) => emit('decidePlan', id, revision, decision)" />
        </template>
        <section v-else class="bs-hq-layout__workplace-details" :aria-label="selectedWorkplace.name">
          <dl><div><dt>{{ content.workplaces.workstationsLabel }}</dt><dd>{{ content.workplaces.workstationsValue }}</dd></div></dl>
          <p>{{ content.workplaces.agentsSpaceLabel }}</p>
          <p class="bs-hq-layout__workplace-description">{{ content.workplaces.workspaceReadyLabel }}</p>
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
  background: linear-gradient(145deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-ink) 70%);
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
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--bs-color-brand-building-navy) 58%, transparent), transparent 64%), linear-gradient(155deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-charcoal) 52%, var(--bs-color-neutral-ink));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 10%, transparent), inset 0 0 60px color-mix(in srgb, var(--bs-color-brand-building-navy) 12%, transparent);
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
.bs-hq-layout__navigation { position: absolute; z-index: 4; top: 18px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 2px; width: max-content; max-width: calc(100% - 32px); padding: 4px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 16%, var(--bs-color-brand-building-navy)); border-radius: 15px; background: linear-gradient(135deg, color-mix(in srgb, var(--bs-color-brand-building-navy) 60%, var(--bs-color-neutral-charcoal)), var(--bs-color-neutral-charcoal)); box-shadow: inset 0 1px color-mix(in srgb, var(--bs-soft-silver) 6%, transparent); cursor: default; }
.bs-hq-layout .bs-hq-layout__tab { min-width: 0; min-height: 38px; padding: 8px 14px; border: 1px solid transparent; border-radius: 11px; background: transparent; color: var(--bs-soft-silver); font-size: 13px; font-weight: 500; line-height: 20px; white-space: nowrap; }
.bs-hq-layout .bs-hq-layout__tab--selected { border-color: color-mix(in srgb, var(--bs-premium-gold) 45%, transparent); background: var(--bs-color-brand-building-navy); color: var(--bs-pearl-white); font-weight: 650; }
.bs-hq-layout__workplace-picker { position: relative; display: flex; align-items: center; flex: 0 1 190px; width: 190px; min-width: 120px; border: 1px solid transparent; border-inline-start-color: color-mix(in srgb, var(--bs-soft-silver) 16%, transparent); border-radius: 10px; }
.bs-hq-layout__workplace-picker--selected { border-color: color-mix(in srgb, var(--bs-premium-gold) 45%, transparent); background: var(--bs-color-brand-building-navy); }
.bs-hq-layout__workplace-picker :deep(.bs-select) { flex: 1; width: 0; min-width: 0; min-height: 36px; height: 36px; border: 0; border-radius: 9px; padding: 0; background: transparent; color: var(--bs-soft-silver); font: inherit; font-size: 13px; box-shadow: none; }
.bs-hq-layout__workplace-picker :deep(.bs-select-label) { padding-inline: 10px 4px; }
.bs-hq-layout__workplace-picker :deep(.bs-select-trigger) { min-width: 28px; min-height: 36px; }
.bs-hq-layout__workplace-picker :deep(.bs-select-overlay) { min-width: 190px; border-color: color-mix(in srgb, var(--bs-premium-gold) 30%, var(--bs-color-brand-building-navy)); background: var(--bs-color-neutral-charcoal); color: var(--bs-pearl-white); }
.bs-hq-layout__workplace-picker :deep(.bs-select-option[data-p-focused='true']) { background: var(--bs-color-brand-building-navy); }
.bs-hq-layout__workplace-picker :deep(.bs-select-option[aria-selected='true']) { background: var(--bs-premium-gold); color: var(--bs-color-neutral-ink); }
.bs-hq-layout .bs-hq-layout__workplace-clear { flex: none; width: 30px; min-height: 36px; padding: 5px; border: 0; background: transparent; color: var(--bs-soft-silver); }
.bs-hq-layout .bs-hq-layout__workplace-clear:hover { color: var(--bs-premium-gold); }
.bs-hq-layout__workplace-picker :deep(.bs-select:focus-visible), .bs-hq-layout__workplace-picker :deep(.bs-select[data-p-focused='true']), .bs-hq-layout__workplace-clear:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__session { position: absolute; z-index: 2; inset-block-start: 18px; inset-inline-end: 20px; display: grid; gap: 7px; width: 204px; padding: 11px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 15%, var(--bs-color-brand-building-navy)); border-radius: 16px; background: linear-gradient(150deg, color-mix(in srgb, var(--bs-color-brand-building-navy) 60%, var(--bs-color-neutral-charcoal)), var(--bs-color-neutral-charcoal) 65%); box-shadow: inset 0 1px color-mix(in srgb, var(--bs-soft-silver) 7%, transparent), 0 4px 16px color-mix(in srgb, var(--bs-color-neutral-ink) 25%, transparent); cursor: default; }
.bs-hq-layout__status { display: flex; align-items: center; gap: 7px; min-height: 20px; color: var(--bs-soft-silver); font-size: 11px; line-height: 1.5; }
.bs-hq-layout__status > span { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-layout .bs-hq-layout__ceo { display: inline-flex; justify-content: center; gap: 7px; width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--bs-premium-gold); border-radius: 9px; background: var(--bs-premium-gold); color: var(--bs-color-neutral-ink); font-size: 12px; font-weight: 650; line-height: 1.5; white-space: normal; }
.bs-hq-layout__account { display: flex; align-items: center; gap: 8px; min-width: 0; padding-top: 7px; border-top: 1px solid var(--bs-color-gray-800); }
.bs-hq-layout__avatar { flex: none; display: grid; place-items: center; width: 30px; height: 30px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 30%, transparent); border-radius: 50%; background: var(--bs-color-brand-building-navy); color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-layout__avatar img { width: 100%; height: 100%; object-fit: cover; }
.bs-hq-layout__identity { display: grid; gap: 2px; min-width: 0; text-align: start; }
.bs-hq-layout__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.bs-hq-layout__identity small { color: var(--bs-color-gray-400); font-size: 10px; overflow-wrap: anywhere; }
.bs-hq-layout .bs-hq-layout__login { display: flex; justify-content: center; gap: 7px; width: 100%; min-height: 32px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 15%, var(--bs-color-brand-building-navy)); border-radius: 9px; background: color-mix(in srgb, var(--bs-color-brand-deep-structure-navy) 60%, var(--bs-color-neutral-graphite)); color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-layout__tab:not(:disabled) { cursor: pointer; }
.bs-hq-layout__tab:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(-100% - var(--bs-space-3)); position: absolute; z-index: 3; inset-block: 80px var(--bs-space-3); inset-inline-start: var(--bs-space-3); width: min(420px, calc(100% - var(--bs-space-6))); display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; padding: var(--bs-space-5); border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 18%, var(--bs-color-brand-building-navy)); border-radius: var(--bs-radius-modal); color: var(--bs-pearl-white); background: linear-gradient(150deg, color-mix(in srgb, var(--bs-color-brand-deep-structure-navy) 60%, var(--bs-color-neutral-charcoal)), var(--bs-color-neutral-charcoal) 72%); box-shadow: var(--bs-shadow-elevation3-dark), inset 0 1px color-mix(in srgb, var(--bs-soft-silver) 7%, transparent); user-select: text; }
:global([dir="rtl"]) .bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(100% + var(--bs-space-3)); }
.bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: transform 280ms cubic-bezier(.22, 1, .36, 1), opacity 200ms ease; will-change: transform; }
.bs-hq-brain-slide-enter-from, .bs-hq-brain-slide-leave-to { transform: translateX(var(--bs-brain-panel-offset)); opacity: 0; }
.bs-hq-layout__brain-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); margin-bottom: var(--bs-space-5); }
.bs-hq-layout__brain-heading h2 { margin: 0; font-size: 19px; font-weight: 650; }
.bs-hq-layout__brain-heading h2:focus { outline: none; }
.bs-hq-layout__brain-heading button { flex: none; color: var(--bs-soft-silver); }
.bs-hq-layout__workplace-description { margin: 0 0 var(--bs-space-4); color: var(--bs-soft-silver); font-size: 13px; line-height: 1.7; }
.bs-hq-layout__workplace-subheading { margin: 0 0 var(--bs-space-4); font-size: 14px; font-weight: 600; }
.bs-hq-layout__workplace-details dl { margin: 0 0 var(--bs-space-4); }
.bs-hq-layout__workplace-details dl > div { display: flex; justify-content: space-between; gap: var(--bs-space-4); padding-block: var(--bs-space-4); border-block: 1px solid var(--bs-color-gray-800); }
.bs-hq-layout__workplace-details dt { color: var(--bs-soft-silver); }
.bs-hq-layout__workplace-details dd { margin: 0; color: var(--bs-premium-gold); font-weight: 600; }
.bs-hq-layout__workplace-details p { font-size: 13px; line-height: 1.7; }
.bs-hq-layout__brain-panel button:focus-visible, .bs-hq-layout__brain-panel input:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-brain { display: grid; gap: var(--bs-space-4); }
.bs-hq-brain__source { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-4); padding-bottom: var(--bs-space-4); border-bottom: 1px solid var(--bs-color-gray-800); font-size: 13px; line-height: 1.6; }
.bs-hq-brain__source p { margin: var(--bs-space-2) 0; color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-brain small { color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-brain__body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-5); }
.bs-hq-brain__directory { min-width: 0; }
.bs-hq-brain__directory input { color: var(--bs-pearl-white); background: color-mix(in srgb, var(--bs-color-brand-deep-structure-navy) 55%, var(--bs-color-neutral-graphite)); border-color: var(--bs-color-gray-800); }
.bs-hq-brain__directory input::placeholder { color: var(--bs-color-gray-400); }
.bs-hq-brain__directory ul { display: grid; gap: var(--bs-space-1); padding: 0; margin: var(--bs-space-3) 0 0; list-style: none; max-height: 29dvh; overflow: auto; overscroll-behavior: contain; }
.bs-hq-brain__directory button { display: grid; width: 100%; min-width: 0; gap: var(--bs-space-1); padding: var(--bs-space-3); text-align: start; color: var(--bs-pearl-white); }
.bs-hq-brain__directory strong { font-size: 13px; font-weight: 600; }
.bs-hq-brain__directory small { overflow-wrap: anywhere; }
.bs-hq-brain__directory button:hover { background: color-mix(in srgb, var(--bs-color-brand-building-navy) 65%, var(--bs-color-neutral-graphite)); }
.bs-hq-brain__directory button[aria-pressed="true"] { background: var(--bs-color-brand-building-navy); border-inline-start: 2px solid var(--bs-premium-gold); }
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
.bs-hq-layout__minimap { position: relative; width: 200px; height: 200px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); border-radius: 50%; background: var(--bs-color-neutral-ink); box-shadow: 0 4px 14px color-mix(in srgb, var(--bs-color-neutral-ink) 25%, transparent); pointer-events: auto; }
.bs-hq-layout__minimap-scene { display: block; width: 100%; height: 100%; }
.bs-hq-layout__map-floor { fill: color-mix(in srgb, var(--bs-color-neutral-charcoal) 75%, var(--bs-color-brand-building-navy)); stroke: color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); stroke-width: .6px; vector-effect: non-scaling-stroke; }
.bs-hq-layout__map-footprint { fill: color-mix(in srgb, var(--bs-soft-silver) 9%, transparent); stroke: color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); stroke-width: .6px; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.bs-hq-layout__map-road { fill: none; stroke: color-mix(in srgb, var(--bs-premium-gold) 65%, var(--bs-soft-silver)); stroke-width: 1px; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__zoom-value { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); padding: 1px 4px; border-radius: 4px; background: var(--bs-color-neutral-ink); color: var(--bs-soft-silver); font-size: 9px; line-height: 1.3; font-variant-numeric: tabular-nums; }
.bs-hq-layout__office-marker { fill: var(--bs-color-brand-building-navy); stroke: var(--bs-soft-silver); stroke-width: 1px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__office-marker--executive { fill: var(--bs-premium-gold); stroke: var(--bs-premium-gold); }
.bs-hq-layout__office-marker--selected { stroke: var(--bs-pearl-white); stroke-width: 2px; }
.bs-hq-layout__plans-panel { width: min(520px, calc(100% - var(--bs-space-6))); }
.bs-hq-layout__minimap-view { fill: none; stroke: color-mix(in srgb, var(--bs-soft-silver) 80%, transparent); stroke-width: 1px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__orb-marker { position: absolute; display: grid; place-items: center; width: 26px; height: 26px; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 50%, transparent); border-radius: 50%; color: var(--bs-premium-gold); background: var(--bs-color-brand-deep-structure-navy); box-shadow: 0 0 14px color-mix(in srgb, var(--bs-premium-gold) 18%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 36px); gap: 2px; padding: 4px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 16%, var(--bs-color-brand-building-navy)); border-radius: 14px; background: linear-gradient(135deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-charcoal)); pointer-events: auto; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 36px; min-width: 0; height: 36px; padding: 0; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled) { cursor: pointer; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled):hover { background: var(--bs-color-brand-building-navy); border-color: var(--bs-premium-gold); color: var(--bs-pearl-white); }
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
  .bs-hq-layout__minimap { width: 180px; height: 180px; }
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
  .bs-hq-layout__navigation { top: 64px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: calc(100% - 24px); max-width: 360px; padding: 3px; }
  .bs-hq-layout .bs-hq-layout__tab { flex: 1; padding: 7px 6px; font-size: 11px; }
  .bs-hq-layout__workplace-picker { grid-column: 1 / -1; width: auto; min-width: 0; border-inline-start: 0; }
  .bs-hq-layout__session { inset-block-start: 164px; inset-inline-end: 12px; width: 172px; padding: 8px; gap: 6px; border-radius: 13px; }
  .bs-hq-layout__status { font-size: 10px; }
  .bs-hq-layout .bs-hq-layout__ceo, .bs-hq-layout .bs-hq-layout__login { font-size: 11px; }
  .bs-hq-layout__brain-panel { inset-block-start: 160px; }
  .bs-hq-layout__footer { padding: 12px; gap: 10px; }
  .bs-hq-layout__workspace-info { max-width: 160px; }
  .bs-hq-layout__gesture-hint { font-size: 9px; }
  .bs-hq-layout__keyboard-hint { display: none; }
  .bs-hq-layout__view { gap: 8px; }
  .bs-hq-layout__minimap { width: 144px; height: 144px; }
  .bs-hq-layout__zoom { grid-template-columns: repeat(3, 32px); }
  .bs-hq-layout .bs-hq-layout__zoom button { width: 32px; height: 32px; border-radius: 9px; }
}
@media (max-width: 374px) {
  .bs-hq-layout__workspace-info { max-width: 120px; }
  .bs-hq-layout__gesture-hint { display: none; }
  .bs-hq-layout__minimap { width: 128px; height: 128px; }
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
