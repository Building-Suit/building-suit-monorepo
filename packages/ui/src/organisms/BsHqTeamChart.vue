<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { usePanZoomViewport } from '@building-suit/ux'
import BsButton from '../atoms/BsButton.vue'
import BsIcon from '../atoms/BsIcon.vue'
import BsInput from '../atoms/BsInput.vue'
import BsTabs from '../molecules/BsTabs.vue'
import type { HqAgentPresentation, HqAgentsPresentation, HqOfficeCopy, HqWorkforceContent } from '../types/hqAgentsPresentation'
import { layoutHqOrgChart } from '../utils/hqOrgChart'

const props = defineProps<{
  chartLabel: string; unassignedLabel: string; emptyLabel: string; refreshLabel: string;
  presentation: HqAgentsPresentation; copy: HqOfficeCopy; locale?: string; founder: boolean;
  controls?: HqWorkforceContent['orgChartControls']
}>()
const emit = defineEmits<{ refresh: []; close: []; selectEmployee: [id: string, event: MouseEvent] }>()
const chart = computed(() => layoutHqOrgChart(props.founder ? props.presentation.agents : [], props.unassignedLabel))
const query = ref('')
const view = ref<'organization' | 'departments' | 'people'>('organization')
const scope = ref<string | null>(null)
const isCanvas = computed(() => view.value === 'organization')
const hasPeople = computed(() => Boolean(chart.value.chief || chart.value.cards.length))
const chartReady = computed(() => props.founder && hasPeople.value && isCanvas.value)
const tabId = useId(), hintId = useId()
const { viewport, pan, scale, dragging, fit, reset, zoomBy, canZoomIn, canZoomOut,
  onPointerDown, onPointerMove, onPointerEnd, onPointerLeave, onLostPointerCapture, onClick, onWheel, onKeydown, onFocusIn,
} = usePanZoomViewport(() => chart.value, () => chartReady.value)
const number = computed(() => new Intl.NumberFormat(props.locale))
const zoomValue = computed(() => `${number.value.format(Math.round(scale.value * 100))}%`)
const copyText = computed(() => props.controls ?? {
  hint: 'Drag in any direction. Scroll to zoom.', label: 'Org chart zoom controls', zoomIn: 'Zoom in',
  zoomOut: 'Zoom out', fit: 'Fit entire org chart', reset: 'Center org chart at 100% zoom',
  subtitle: 'Our team structure and departments', organization: 'Organization', departments: 'Departments',
  people: 'People', search: 'Search team…', noMatches: 'No matching team members.', more: 'More employees',
})
const tabs = computed(() => [
  { value: 'organization', label: copyText.value.organization, icon: 'team' as const },
  { value: 'departments', label: copyText.value.departments, icon: 'layers' as const },
  { value: 'people', label: copyText.value.people, icon: 'user' as const },
])
const search = computed(() => query.value.trim().toLocaleLowerCase(props.locale))
function matches(value?: string) { return Boolean(value?.toLocaleLowerCase(props.locale).includes(search.value)) }
function matchesAgent(agent: HqAgentPresentation) {
  return matches(agent.name) || matches(agent.roleLabel) || matches(agent.departmentName)
}
const departments = computed(() => chart.value.cards
  .filter(group => isCanvas.value || !scope.value || group.key === scope.value)
  .map(group => ({
    ...group, shown: !search.value || matches(group.name) ? group.members : group.members.filter(matchesAgent),
  })).filter(group => !search.value || group.shown.length))
const people = computed(() => props.founder ? props.presentation.agents.filter(agent => !search.value || matchesAgent(agent)) : [])
const chiefMatches = computed(() => Boolean(chart.value.chief && (!search.value || matchesAgent(chart.value.chief))))
const emptySearch = computed(() => Boolean(search.value && (view.value === 'people' ? !people.value.length
  : !departments.value.length && (!isCanvas.value || !chiefMatches.value))))
function selectView(value: string) {
  if (value !== 'organization' && value !== 'departments' && value !== 'people') return
  scope.value = null
  view.value = value
}
function showDepartment(key: string) { scope.value = key; view.value = 'departments' }
function firstInitial(name: string) { return Array.from(name.trim())[0]?.toLocaleUpperCase(props.locale) ?? '' }
function employeeStatus(agent: HqAgentPresentation) {
  return agent.activity === 'working' ? agent.activityLabel ?? agent.connectionLabel : agent.connectionLabel ?? agent.activityLabel
}
function employeeLabel(agent: HqAgentPresentation) {
  return `${props.copy.agentDetails}: ${agent.name} · ${agent.departmentName || props.unassignedLabel}`
}
function employeeDescription(agent: HqAgentPresentation) {
  return [agent.roleLabel, employeeStatus(agent)].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="bs-hq-team">
    <header class="bs-hq-team__toolbar">
      <BsTabs v-if="founder" variant="hq" :tabs="tabs" :model-value="view" :label="chartLabel" :id-prefix="tabId" class="bs-hq-team__tabs" @update:model-value="selectView" />
      <div class="bs-hq-team__tools">
        <div v-if="founder" class="bs-hq-team__search"><BsIcon name="search" :size="17" /><BsInput v-model="query" type="search" :aria-label="copyText.search" :placeholder="copyText.search" @update:model-value="scope = null" /></div>
        <BsButton v-if="founder" variant="icon" :disabled="presentation.pending || presentation.refreshing" :aria-label="refreshLabel" :title="refreshLabel" @click="emit('refresh')"><BsIcon name="refresh" :size="17" /></BsButton>
        <BsButton variant="icon" :aria-label="copy.close" :title="copy.close" @click="emit('close')"><BsIcon name="close" :size="19" /></BsButton>
      </div>
    </header>

    <div :id="`${tabId}-panel`" class="bs-hq-team__body" :role="founder ? 'tabpanel' : undefined" :aria-labelledby="founder ? `${tabId}-${view}` : undefined">
      <div class="bs-hq-team__heading">
        <h3>{{ view === 'organization' ? chartLabel : view === 'departments' ? copyText.departments : copyText.people }}</h3>
        <p>{{ copyText.subtitle }}</p>
      </div>
      <slot v-if="!founder" name="access" />
      <p v-else-if="!hasPeople || emptySearch" class="bs-hq-team__message" role="status">{{ presentation.pending ? copy.loading : emptySearch ? copyText.noMatches : emptyLabel }}</p>

      <div v-else-if="view === 'people'" class="bs-hq-team__directory">
        <BsButton v-for="agent in people" :key="agent.id" variant="tile" align="start" class="bs-hq-team__employee" :aria-label="employeeLabel(agent)" :aria-description="employeeDescription(agent)" @click="emit('selectEmployee', agent.id, $event)">
          <span class="bs-hq-team__avatar">{{ firstInitial(agent.name) }}</span>
          <span><strong dir="auto">{{ agent.name }}</strong><small dir="auto">{{ agent.roleLabel }}</small></span>
        </BsButton>
      </div>

      <div v-else ref="viewport" class="bs-hq-team__viewport" :class="{ 'bs-hq-team__viewport--canvas': isCanvas }" :data-dragging="dragging || undefined"
        role="region" :aria-label="chartLabel" :aria-describedby="isCanvas ? hintId : undefined" :aria-busy="presentation.pending" tabindex="0"
        @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @pointerleave="onPointerLeave" @lostpointercapture="onLostPointerCapture" @click.capture="onClick" @wheel="onWheel" @keydown="onKeydown" @focusin="onFocusIn">
        <div class="bs-hq-team__map" :class="{ 'bs-hq-team__map--canvas': isCanvas }" :style="isCanvas ? { width: `${chart.width}px`, height: `${chart.height}px`, transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})` } : undefined">
          <template v-if="isCanvas && chart.chief">
            <div class="bs-hq-team__orbit" :style="{ left: `${chart.centerX}px`, top: `${chart.centerY}px` }" aria-hidden="true" />
            <svg class="bs-hq-team__edges" aria-hidden="true" focusable="false" :viewBox="`0 0 ${chart.width} ${chart.height}`">
              <g v-for="edge in chart.edges" v-show="departments.some(group => group.key === edge.id)" :key="edge.id">
                <line :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2" />
                <circle :cx="edge.x1" :cy="edge.y1" r="4.5" /><circle :cx="edge.x2" :cy="edge.y2" r="5" />
              </g>
            </svg>
            <BsButton v-show="chiefMatches" variant="tile" class="bs-hq-team__employee bs-hq-team__chief" data-executive :style="{ left: `${chart.centerX}px`, top: `${chart.centerY}px`, width: `${chart.hubSize}px`, height: `${chart.hubSize}px` }" :aria-label="employeeLabel(chart.chief)" :aria-description="employeeDescription(chart.chief)" @click="chart.chief && emit('selectEmployee', chart.chief.id, $event)">
              <svg viewBox="0 0 48 40" width="46" height="39" aria-hidden="true"><path d="M4 9l11 9 9-15 9 15 11-9-6 27H10z" fill="currentColor"/><circle cx="4" cy="9" r="2.5" fill="currentColor"/><circle cx="24" cy="3" r="2.5" fill="currentColor"/><circle cx="44" cy="9" r="2.5" fill="currentColor"/></svg>
              <strong dir="auto">{{ chart.chief.name }}</strong><small>{{ chart.chief.roleLabel }}</small>
            </BsButton>
          </template>
          <article v-for="group in departments" :key="group.key" class="bs-hq-team__department" :data-tone="group.tone"
            :style="isCanvas ? { insetInlineStart: `${group.x}px`, top: `${group.y}px`, width: `${group.width}px`, minHeight: `${group.height}px` } : undefined">
            <header><span class="bs-hq-team__department-icon"><BsIcon :name="group.icon" :size="24" /></span><span class="bs-hq-team__count">{{ number.format(group.members.length) }}</span></header>
            <h4 dir="auto">{{ group.name }}</h4>
            <div class="bs-hq-team__members" :class="{ 'bs-hq-team__members--three': group.shown.length === 3 }">
              <BsButton v-for="agent in (isCanvas ? group.shown.slice(0, 4) : group.shown)" :key="agent.id" variant="tile" align="start" class="bs-hq-team__employee" :aria-label="employeeLabel(agent)" :aria-description="employeeDescription(agent)" @click="emit('selectEmployee', agent.id, $event)">
                <span class="bs-hq-team__avatar" aria-hidden="true">{{ firstInitial(agent.name) }}</span><strong dir="auto" :title="agent.name">{{ agent.name }}</strong>
              </BsButton>
            </div>
            <BsButton v-if="isCanvas && group.shown.length > 4" variant="secondary" size="sm" :aria-label="`${copyText.more}: ${group.shown.length - 4}`" @click="showDepartment(group.key)">+{{ number.format(group.shown.length - 4) }}</BsButton>
          </article>
          <BsButton v-if="!isCanvas && scope" variant="secondary" size="sm" @click="scope = null">{{ copyText.departments }}</BsButton>
        </div>
      </div>
      <div v-if="chartReady" class="bs-hq-team__navigation">
        <p :id="hintId">{{ copyText.hint }}</p>
        <div class="bs-hq-team__zoom" role="group" :aria-label="copyText.label">
          <BsButton variant="icon" :disabled="!canZoomOut" :aria-label="copyText.zoomOut" :title="copyText.zoomOut" @click="zoomBy(1 / 1.2)"><BsIcon name="minus" :size="18" /></BsButton>
          <BsButton variant="text" :aria-label="`${copyText.reset} · ${zoomValue}`" :title="copyText.reset" @click="reset">{{ zoomValue }}</BsButton>
          <BsButton variant="icon" :disabled="!canZoomIn" :aria-label="copyText.zoomIn" :title="copyText.zoomIn" @click="zoomBy(1.2)"><BsIcon name="add" :size="18" /></BsButton>
          <BsButton variant="icon" :aria-label="copyText.fit" :title="copyText.fit" @click="fit"><BsIcon name="maximize" :size="18" /></BsButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bs-hq-team {
  position: relative; isolation: isolate; display: flex; flex: 1; flex-direction: column;
  min-width: 0; min-height: 0; overflow: hidden; color: var(--bs-text);
}
.bs-hq-team h3, .bs-hq-team h4, .bs-hq-team p { margin: 0; }
.bs-hq-team__toolbar { z-index: 2; display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: 16px; padding: 16px clamp(16px,3vw,46px) 8px; }
.bs-hq-team__tabs { grid-column: 2; justify-self: center; justify-content: center; flex-wrap: wrap; max-width: 100%; background: var(--bs-component-hq-glass-panel); backdrop-filter: blur(var(--bs-component-hq-glass-blur)); }
.bs-hq-team__tools { grid-column: 3; display: flex; align-items: center; justify-content: end; gap: 5px; min-width: 0; }
.bs-hq-team__search { display: flex; align-items: center; gap: 6px; min-width: 0; width: min(230px, 100%); padding: 0 9px; border: 1px solid var(--bs-border); border-radius: 13px; background: var(--bs-component-hq-glass-control); color: var(--bs-text-muted); }
.bs-hq-team__search :deep(svg) { flex: none; }
.bs-hq-team__search :deep(input) { min-width: 0; min-height: 34px; border: 0; padding: 0; background: transparent; color: var(--bs-text); font-size: .84rem; }
.bs-hq-team__body { flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0; }
.bs-hq-team__heading { z-index: 1; flex: none; padding: 12px clamp(16px,3vw,46px) 0; pointer-events: none; }
.bs-hq-team__heading h3 { font-size: clamp(1.3rem,2.1vw,2rem); font-weight: 750; line-height: 1.15; }
.bs-hq-team__heading p { margin-top: 5px; font-size: clamp(.83rem,1.2vw,1.04rem); color: var(--bs-text-muted); }
.bs-hq-team__heading::after { content: ''; display: block; width: 43px; height: 3px; border-radius: 3px; margin-top: 12px; background: var(--bs-premium-gold); }
.bs-hq-team__message { padding: var(--bs-space-5); }
.bs-hq-team__viewport, .bs-hq-team__directory { position: relative; min-height: 0; flex: 1; overflow: auto; }
.bs-hq-team__viewport--canvas { overflow: clip; cursor: grab; touch-action: none; user-select: none; }
.bs-hq-team__viewport--canvas[data-dragging], .bs-hq-team__viewport--canvas[data-dragging] * { cursor: grabbing; }
.bs-hq-team__map, .bs-hq-team__directory { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,245px),1fr)); gap: 16px; padding: 20px clamp(16px,3vw,46px); align-content: start; }
.bs-hq-team__map--canvas { position: absolute; left: 50%; top: 50%; display: block; padding: 0; transform-origin: center; }
.bs-hq-team__department { --bs-text: var(--bs-color-brand-deep-structure-navy); --bs-text-muted: var(--bs-color-secondary-slate-blue); color: var(--bs-text); --tone: var(--bs-premium-gold); display: grid; align-content: start; gap: 10px; box-sizing: border-box; padding: 13px 22px 16px; border: 1px solid var(--bs-border); border-inline-start: 4px solid color-mix(in srgb,var(--tone) 58%,var(--bs-color-brand-white)); border-radius: 28px; background: color-mix(in srgb,var(--bs-color-brand-white) 76%,var(--bs-color-brand-pearl-white)); box-shadow: 0 13px 24px color-mix(in srgb,var(--bs-text) 12%,transparent); }
.bs-hq-team__map--canvas .bs-hq-team__department { position: absolute; }
.bs-hq-team__department[data-tone='cs'] { --tone: var(--bs-color-semantic-success); }
.bs-hq-team__department[data-tone='dev'] { --tone: var(--bs-color-secondary-slate-blue); }
.bs-hq-team__department[data-tone='email'] { --tone: var(--bs-color-semantic-success-dark); }
.bs-hq-team__department[data-tone='hr'] { --tone: var(--bs-color-semantic-error); }
.bs-hq-team__department[data-tone='res'] { --tone: var(--bs-color-semantic-info); }
.bs-hq-team__department[data-tone='soc'] { --tone: var(--bs-color-secondary-sky-steel); }
.bs-hq-team__department header { display: flex; align-items: start; justify-content: space-between; }
.bs-hq-team__department-icon, .bs-hq-team__count { display: grid; place-items: center; }
.bs-hq-team__department-icon { width: 40px; height: 40px; border-radius: 11px; color: color-mix(in srgb,var(--tone) 76%,var(--bs-text)); background: color-mix(in srgb,var(--tone) 15%,var(--bs-color-brand-white)); }
.bs-hq-team__count { min-width: 31px; height: 29px; border-radius: 14px; background: color-mix(in srgb,var(--bs-color-secondary-pale-sky) 50%,var(--bs-color-brand-white)); font-weight: 700; font-variant-numeric: tabular-nums; }
.bs-hq-team__department h4 { font-size: 17px; font-weight: 750; line-height: 1.15; overflow-wrap: anywhere; }
.bs-hq-team__members { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 5px 9px; }
.bs-hq-team__members--three { grid-template-columns: repeat(3,minmax(0,1fr)); }
.bs-hq-team .bs-hq-team__employee { display: flex; min-width: 0; align-items: center; gap: 6px; padding: 3px 0; border: 0; background: transparent; text-align: start; color: var(--bs-text); font-size: 13px; }
.bs-hq-team__employee strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.bs-hq-team__avatar { display: grid; flex: none; place-items: center; width: 31px; height: 31px; border-radius: 50%; background: color-mix(in srgb,var(--bs-color-secondary-pale-sky) 60%,var(--bs-color-brand-white)); font-weight: 750; }
.bs-hq-team__employee:hover .bs-hq-team__avatar { background: color-mix(in srgb,var(--tone,var(--bs-premium-gold)) 23%,var(--bs-color-brand-white)); }
.bs-hq-team__directory .bs-hq-team__avatar { color: var(--bs-color-brand-deep-structure-navy); }
.bs-hq-team__directory small { display: block; color: var(--bs-text-muted); }
.bs-hq-team__orbit { position: absolute; width: 720px; height: 670px; transform: translate(-50%,-50%); border-radius: 50%; background: color-mix(in srgb,var(--bs-component-hq-glass-card) 45%,transparent); box-shadow: inset 0 0 50px var(--bs-component-hq-glass-card); }
.bs-hq-team__edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.bs-hq-team__edges line { stroke: var(--bs-premium-gold); stroke-width: 1.65; }
.bs-hq-team__edges circle { fill: var(--bs-premium-gold); }
.bs-hq-team__edges:dir(rtl) { transform: scaleX(-1); }
.bs-hq-team .bs-hq-team__chief { position: absolute; transform: translate(-50%,-50%); display: flex; flex-direction: column; justify-content: center; gap: 11px; border: 3px solid var(--bs-color-brand-white); border-radius: 50%; background: radial-gradient(circle at 38% 9%, var(--bs-color-brand-navy-surface-raised), var(--bs-color-brand-midnight-background)); color: var(--bs-color-brand-white); box-shadow: 0 0 0 2px var(--bs-premium-gold), 0 0 0 12px color-mix(in srgb,var(--bs-premium-gold) 15%,transparent), inset 0 8px 22px color-mix(in srgb,var(--bs-premium-gold) 23%,transparent); }
.bs-hq-team__chief svg { color: var(--bs-highlight-gold); }
.bs-hq-team__chief strong { font-size: 32px; max-width: 82%; }
.bs-hq-team__chief small { padding: 5px 18px; border-radius: 16px; background: var(--bs-highlight-gold); color: var(--bs-color-brand-deep-structure-navy); font-size: 16px; font-weight: 750; }
.bs-hq-team :deep(button:focus-visible), .bs-hq-team__viewport:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: -2px; }
.bs-hq-team__navigation { position: absolute; inset-inline: clamp(12px,2vw,26px); inset-block-end: 10px; display: flex; justify-content: space-between; align-items: end; gap: 6px; pointer-events: none; }
.bs-hq-team__navigation p, .bs-hq-team__zoom { border: 1px solid var(--bs-border); background: var(--bs-component-hq-glass-control); border-radius: 12px; padding: 5px 9px; }
.bs-hq-team__navigation p { color: var(--bs-text-muted); font-size: .72rem; }
.bs-hq-team__zoom { pointer-events: auto; display: flex; gap: 2px; align-items: center; font-variant-numeric: tabular-nums; }
.bs-hq-team__zoom :deep(button) { min-width: 30px; min-height: 32px; padding: 4px 6px; color: var(--bs-text); }
@media (min-width: 1100px) {
  .bs-hq-team__body:has(.bs-hq-team__viewport--canvas) .bs-hq-team__heading { position: absolute; inset-block-start: 0; inset-inline-start: 0; }
}
@media (max-width: 820px) {
  .bs-hq-team__toolbar { grid-template-columns: 1fr auto; gap: 6px; padding-top: 9px; }
  .bs-hq-team__tabs { grid-row: 2; grid-column: 1 / -1; justify-self: center; }
  .bs-hq-team__tools { grid-column: 1 / -1; grid-row: 1; }
  .bs-hq-team__navigation p { max-width: 40%; }
}
</style>
