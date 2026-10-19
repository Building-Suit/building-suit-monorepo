<script setup lang="ts">
import type { BsUsageItem } from '@building-suit/contracts'
import { usagePercentage } from '../utils/presentation'
const props = defineProps<{ item: BsUsageItem; compact?: boolean }>()
const ratio = computed(() => usagePercentage(props.item.used, props.item.limit))
</script>

<template>
  <article class="bs-usage-meter" :data-compact="compact || undefined" :data-tone="item.tone || 'neutral'">
    <div class="bs-pattern-heading">
      <div>
        <h3>{{ item.label }}</h3>
        <p v-if="item.description">{{ item.description }}</p>
      </div>
      <BsStatusBadge v-if="item.status" :status="item.status" :tone="item.tone" />
    </div>
    <p class="bs-usage-meter__value" dir="auto">{{ item.valueLabel }}</p>
    <div v-if="ratio !== null" class="bs-usage-meter__track" role="progressbar" :aria-label="item.label" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="ratio" :aria-valuetext="item.valueLabel">
      <span :style="{ width: `${ratio}%` }" />
    </div>
    <p v-if="item.nextAllowance">{{ item.nextAllowance }}</p>
    <BsLink v-if="item.action" :to="item.action.to">{{ item.action.label }}</BsLink>
  </article>
</template>

<style scoped>
.bs-usage-meter { padding: var(--bs-component-dashboard-metric-padding); background: var(--bs-component-dashboard-chart-surface); }
.bs-usage-meter__value { font-size: var(--bs-type-h1-size); line-height: var(--bs-type-h1-lh); font-weight: var(--bs-weight-semibold); }
.bs-usage-meter[data-tone='neutral'] .bs-usage-meter__track > span { background: linear-gradient(90deg, var(--bs-primary), var(--bs-accent)); }
.bs-usage-meter :deep(h3) { font-weight: var(--bs-weight-medium); }
</style>
