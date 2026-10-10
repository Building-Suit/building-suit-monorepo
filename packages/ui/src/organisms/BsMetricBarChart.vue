<script setup lang="ts">
import type { BsChartSeries, BsChartPoint } from '@building-suit/contracts'
const props = defineProps<{ label: string; pointLabel?: string; series: BsChartSeries[]; tableSeries?: BsChartSeries[]; points: BsChartPoint[]; tableLabel: string; emptyLabel: string; loading?: boolean; error?: string | null }>()
const extent = computed(() => Math.max(1, ...props.points.flatMap(point => props.series.map(series => Math.abs(point.values[series.id] || 0))).filter(Number.isFinite)))
function height(value: number) { return Number.isFinite(value) ? Math.abs(value) / extent.value * 100 : 0 }
const columns = computed(() => [{ key: 'label', field: 'label', header: props.pointLabel || props.label }, ...(props.tableSeries || props.series).map(series => ({ key: series.id, header: series.label, value: (point: BsChartPoint) => point.formattedValues?.[series.id] ?? point.values[series.id] ?? 0 }))])
</script>

<template>
  <section class="bs-metric-chart" :aria-label="label">
    <BsSectionSkeleton v-if="loading" variant="table" />
    <BsStateSurface v-else-if="error" state="error" :title="error" />
    <BsStateSurface v-else-if="!points.length" state="empty" :title="emptyLabel" />
    <template v-else>
      <BsChartLegend :series="series" />
      <div class="bs-metric-chart__scroll">
        <div class="bs-metric-chart__plot">
          <div v-for="point in points" :key="point.id" class="bs-metric-chart__point">
            <div class="bs-metric-chart__bars" aria-hidden="true">
              <span v-for="seriesItem in series" :key="seriesItem.id" :data-tone="seriesItem.tone || 'neutral'" :data-negative="(point.values[seriesItem.id] ?? 0) < 0 || undefined" :style="{ height: `${height(point.values[seriesItem.id] ?? 0)}%` }" :title="`${seriesItem.label}: ${point.formattedValues?.[seriesItem.id] ?? point.values[seriesItem.id] ?? 0}`" />
            </div>
            <p>{{ point.label }}</p>
          </div>
        </div>
      </div>
      <BsDisclosure :summary="tableLabel">
        <BsDataTable :value="points" :columns="columns" :label="label" density="compact" />
      </BsDisclosure>
    </template>
  </section>
</template>
