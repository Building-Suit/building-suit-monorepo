<script setup lang="ts">
import type { BsChartSeries, BsChartPoint } from '@building-suit/contracts'
const props = withDefaults(defineProps<{ label: string; pointLabel?: string; series: BsChartSeries[]; tableSeries?: BsChartSeries[]; points: BsChartPoint[]; tableLabel: string; emptyLabel: string; presentation?: 'default' | 'dashboard'; loading?: boolean; error?: string | null }>(), { presentation: 'dashboard' })
const extent = computed(() => Math.max(1, ...props.points.flatMap(point => props.series.map(series => Math.abs(point.values[series.id] || 0))).filter(Number.isFinite)))
function height(value: number) { return Number.isFinite(value) ? Math.abs(value) / extent.value * 100 : 0 }
const hasActivity = computed(() => props.points.some(point => props.series.some(series => Number.isFinite(point.values[series.id]) && point.values[series.id] !== 0)))
const columns = computed(() => [{ key: 'label', field: 'label', header: props.pointLabel || props.label }, ...(props.tableSeries || props.series).map(series => ({ key: series.id, header: series.label, value: (point: BsChartPoint) => point.formattedValues?.[series.id] ?? point.values[series.id] ?? 0 }))])
</script>

<template>
  <section class="bs-metric-chart" :data-presentation="presentation" :aria-label="label">
    <BsSectionSkeleton v-if="loading" variant="table" />
    <BsStateSurface v-else-if="error" state="error" :title="error" />
    <BsStateSurface v-else-if="!points.length" state="empty" :title="emptyLabel" />
    <template v-else>
      <BsChartLegend :series="series" />
      <p v-if="presentation === 'dashboard' && !hasActivity" class="bs-metric-chart__zero-note">{{ emptyLabel }}</p>
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

<style scoped>
.bs-metric-chart { --bs-chart-primary: var(--bs-color-brand-building-navy); --bs-chart-secondary: var(--bs-color-brand-premium-gold); }
:global(.dark) .bs-metric-chart { --bs-chart-primary: var(--bs-color-brand-premium-gold); --bs-chart-secondary: var(--bs-color-secondary-sky-steel); }
.bs-metric-chart[data-presentation='dashboard'] :deep(.bs-chart-legend [data-tone='neutral']) { background: var(--bs-chart-primary); }
.bs-metric-chart[data-presentation='dashboard'] :deep(.bs-chart-legend [data-tone='warning']) { background: var(--bs-chart-secondary); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__plot { margin-block-end: var(--bs-space-4); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__point p { margin-inline: auto; }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars { gap: var(--bs-space-3); border-block-end: 0; }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars > span { inline-size: var(--bs-component-dashboard-chart-bar-width); }
.bs-metric-chart__zero-note { margin-block: var(--bs-space-3); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__plot { max-inline-size: none; min-block-size: 220px; padding-block-start: var(--bs-space-3); background: repeating-linear-gradient(to top, var(--bs-border) 0 1px, transparent 1px 25%); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars { block-size: 200px; }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars > span { min-block-size: 2px; }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars > span[data-tone='neutral'] { background-image: linear-gradient(to top, var(--bs-chart-primary), color-mix(in oklab, var(--bs-chart-primary) 64%, var(--bs-surface))); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars > span[data-tone='warning'] { background-image: linear-gradient(to top, var(--bs-chart-secondary), color-mix(in oklab, var(--bs-chart-secondary) 64%, var(--bs-surface))); }
.bs-metric-chart[data-presentation='dashboard'] .bs-metric-chart__bars > span[data-negative] { background-image: repeating-linear-gradient(135deg, transparent 0 3px, var(--bs-surface) 3px 4px); }
</style>
