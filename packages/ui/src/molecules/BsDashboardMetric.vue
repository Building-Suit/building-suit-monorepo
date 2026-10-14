<script setup lang="ts">
import type { BsDashboardMetric } from '../types/dashboardPresentation'
defineProps<{ metric: BsDashboardMetric }>()
const emit = defineEmits<{ source: [location: string, path: string] }>()
</script>
<template>
  <BsActionTile v-if="metric.to || metric.source" :to="metric.to || undefined" class="bs-dashboard-metric" @click="!metric.to && metric.source && emit('source', metric.source.location, metric.source.path)">
    <template #trailing><BsIcon name="arrowRight" directional :size="20" class="bs-dashboard-metric__arrow" /></template>
    <p class="bs-dashboard-metric__title">{{ metric.title }}</p>
    <p class="bs-dashboard-metric__value">{{ metric.value }}</p>
    <p v-if="metric.hint" class="bs-dashboard-metric__hint">{{ metric.hint }}</p>
  </BsActionTile>
  <BsCard v-else padding="none" class="bs-dashboard-metric">
    <p class="bs-dashboard-metric__title">{{ metric.title }}</p>
    <p class="bs-dashboard-metric__value">{{ metric.value }}</p>
    <p v-if="metric.hint" class="bs-dashboard-metric__hint">{{ metric.hint }}</p>
  </BsCard>
</template>
<style scoped>
.bs-dashboard-metric { block-size: 100%; min-block-size: var(--bs-component-dashboard-metric-minimum-height); padding: var(--bs-component-dashboard-metric-padding); box-shadow: none; align-items: stretch; }
.bs-dashboard-metric__title { margin: 0; font-size: var(--bs-type-body-m-size); line-height: var(--bs-type-body-m-lh); color: var(--bs-text-muted); }
.bs-dashboard-metric__value { margin-block: var(--bs-component-dashboard-metric-value-gap) var(--bs-component-dashboard-metric-padding); font-size: var(--bs-type-h2-size); line-height: var(--bs-type-h2-lh); font-weight: var(--bs-weight-bold); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.bs-dashboard-metric__hint { margin: 0; font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); }
.bs-dashboard-metric :deep(.bs-action-tile__content) { gap: 0; }
.bs-dashboard-metric__arrow { align-self: center; }
</style>
