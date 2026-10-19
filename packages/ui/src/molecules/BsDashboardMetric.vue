<script setup lang="ts">
import type { BsDashboardMetric } from '../types/dashboardPresentation'
withDefaults(defineProps<{ metric: BsDashboardMetric; appearance?: 'default' | 'primary' | 'accent' | 'compact' }>(), { appearance: 'default' })
const emit = defineEmits<{ source: [location: string, path: string] }>()
</script>
<template>
  <BsKpiCard class="bs-dashboard-metric" :title="metric.title" :value="metric.value" :icon="metric.icon" :hint="metric.hint" :change-label="metric.changeLabel" :tone="metric.tone" :to="metric.to || undefined" :actionable="Boolean(metric.source)" :appearance="appearance" @click="!metric.to && metric.source && emit('source', metric.source.location, metric.source.path)" />
</template>
