<script setup lang="ts">
import BsActionTile from './BsActionTile.vue'
import BsCard from './BsCard.vue'
const props = withDefaults(defineProps<{
  title: string
  value?: string | number
  icon?: string
  to?: string
  actionable?: boolean
  appearance?: 'auto' | 'default' | 'primary' | 'accent' | 'compact'
  changeLabel?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | string
  hint?: string
}>(), { value: undefined, icon: undefined, to: undefined, actionable: false, appearance: 'auto', changeLabel: undefined, tone: 'neutral', hint: undefined })
const emit = defineEmits<{ click: [event: MouseEvent] }>()
const toneClass = computed(() => ({
  neutral: 'text-fg-muted', success: 'text-[var(--bs-status-success)]',
  warning: 'text-[var(--bs-status-warning)]', danger: 'text-[var(--bs-status-error)]',
  info: 'text-[var(--bs-status-info)]',
}[props.tone] ?? props.tone))
</script>
<template>
  <component :is="to || actionable ? BsActionTile : BsCard"
    v-bind="to || actionable ? { to: to || undefined } : { padding: 'none' as const }"
    class="bs-kpi-card bs-metric-card" :data-appearance="appearance"
    @click="(event: MouseEvent) => { if (to || actionable) emit('click', event) }">
    <template v-if="to || actionable" #trailing><BsIcon name="arrowRight" directional :size="16" class="bs-metric-card__arrow" /></template>
    <div class="bs-metric-card__heading"><p class="bs-metric-card__title">{{ title }}</p><BsIcon v-if="icon" :name="icon" :size="20" class="bs-metric-card__icon" /></div>
    <div class="bs-metric-card__value"><slot>{{ value }}</slot></div>
    <p v-if="changeLabel" class="bs-metric-card__change" :class="toneClass">{{ changeLabel }}</p>
    <p v-else-if="hint" class="bs-metric-card__hint">{{ hint }}</p>
  </component>
</template>
<style scoped>
.bs-metric-card { position: relative; overflow: hidden; min-inline-size: 0; block-size: 100%; min-block-size: var(--bs-metric-minimum-height, var(--bs-component-dashboard-metric-minimum-height)); padding: var(--bs-metric-padding, var(--bs-component-dashboard-metric-padding)); border: var(--bs-metric-border, 1px solid var(--bs-border)); border-radius: var(--bs-metric-radius, var(--bs-radius-card)); background: var(--bs-metric-background, var(--bs-surface)); color: var(--bs-metric-text, var(--bs-text)); box-shadow: none; align-items: stretch; }
.bs-metric-card__heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); }
.bs-metric-card__title { margin: 0; font-size: var(--bs-type-body-m-size); line-height: var(--bs-type-body-m-lh); color: var(--bs-metric-caption, var(--bs-text-muted)); }
.bs-metric-card__value { margin-block: var(--bs-component-dashboard-metric-value-gap) var(--bs-metric-value-bottom, var(--bs-space-4)); font-size: var(--bs-metric-value-size, var(--bs-type-h1-size)); line-height: var(--bs-metric-value-line, var(--bs-type-h1-lh)); font-weight: var(--bs-weight-semibold); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.bs-metric-card__value :deep(.bs-text--tone-default) { color: inherit; }
.bs-metric-card__value :deep(.bs-text) { font-size: inherit; line-height: inherit; font-weight: inherit; }
.bs-metric-card__hint, .bs-metric-card__change { margin: 0; font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); }
.bs-metric-card__change.text-fg-muted { color: var(--bs-metric-caption, var(--bs-text-muted)); }
.bs-metric-card__hint { color: var(--bs-metric-caption, var(--bs-text-muted)); }
.bs-metric-card__icon { flex: none; color: var(--bs-metric-icon, var(--bs-primary)); }
.bs-metric-card__arrow { align-self: center; color: var(--bs-metric-icon, var(--bs-text-muted)); }
.bs-metric-card :deep(.bs-action-tile__content) { gap: 0; }
.bs-metric-card[data-appearance='default'] { --bs-metric-background: var(--bs-surface); --bs-metric-text: var(--bs-text); --bs-metric-caption: var(--bs-text-muted); --bs-metric-icon: var(--bs-primary); }
.bs-metric-card[data-appearance='primary'] { --bs-metric-background: var(--bs-component-dashboard-metric-primary-background); --bs-metric-text: var(--bs-color-brand-pearl-white); --bs-metric-caption: var(--bs-color-brand-cloud-gray); --bs-metric-icon: var(--bs-color-brand-highlight-gold); --bs-metric-value-size: var(--bs-type-display-size); --bs-metric-value-line: var(--bs-type-display-lh); border-color: var(--bs-color-brand-steel-border); }
.bs-metric-card[data-appearance='accent'] { --bs-metric-background: var(--bs-component-dashboard-metric-accent-background); border-color: color-mix(in oklab, var(--bs-color-brand-premium-gold) 32%, var(--bs-border)); }
.bs-metric-card[data-appearance='compact'] { --bs-metric-minimum-height: 0; --bs-metric-padding: var(--bs-space-4); --bs-metric-border: 0; --bs-metric-radius: 0; --bs-metric-value-bottom: var(--bs-space-1); --bs-metric-value-size: var(--bs-type-h3-size); --bs-metric-value-line: var(--bs-type-h3-lh); --bs-metric-icon: var(--bs-text-muted); }
.bs-metric-card[data-appearance='compact'] .bs-metric-card__icon { inline-size: 16px; block-size: 16px; }
.bs-metric-card:is(a, button):hover { background: var(--bs-metric-background, var(--bs-surface-muted)); }
</style>
