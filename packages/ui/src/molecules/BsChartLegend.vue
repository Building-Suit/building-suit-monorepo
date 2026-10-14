<script setup lang="ts">
import type { BsChartSeries } from '@building-suit/contracts'
defineProps<{ series: BsChartSeries[] }>()
</script>

<template>
  <ul class="bs-chart-legend">
    <li v-for="seriesItem in series" :key="seriesItem.id">
      <span :data-tone="seriesItem.tone || 'neutral'" aria-hidden="true" />{{ seriesItem.label }}</li>
  </ul>
</template>
