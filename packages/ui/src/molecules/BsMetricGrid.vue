<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section'; columns?: 1 | 2 | 3 | 4; variant?: 'summary' | 'neutral' | 'compact' }>(), { as: 'div', columns: 4, variant: 'summary' })
</script>
<template>
  <component :is="as" class="bs-metric-grid" :data-columns="columns" :data-variant="variant"><div class="bs-metric-grid__items"><slot /></div></component>
</template>
<style scoped>
.bs-metric-grid { min-inline-size: 0; container: bs-metrics / inline-size; }
.bs-metric-grid__items { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-4); }
.bs-metric-grid__items > :deep(*) { min-inline-size: 0; }
.bs-metric-grid[data-variant='summary'] :deep(.bs-metric-card:first-child[data-appearance='auto']) { --bs-metric-background: var(--bs-component-dashboard-metric-primary-background); --bs-metric-text: var(--bs-color-brand-pearl-white); --bs-metric-caption: var(--bs-color-brand-cloud-gray); --bs-metric-icon: var(--bs-color-brand-highlight-gold); --bs-metric-value-size: var(--bs-type-display-size); --bs-metric-value-line: var(--bs-type-display-lh); border-color: var(--bs-color-brand-steel-border); }
.bs-metric-grid[data-variant='summary'] :deep(.bs-metric-card:nth-child(2)[data-appearance='auto']) { --bs-metric-background: var(--bs-component-dashboard-metric-accent-background); border-color: color-mix(in oklab, var(--bs-color-brand-premium-gold) 32%, var(--bs-border)); }
.bs-metric-grid[data-variant='compact'] .bs-metric-grid__items { gap: 1px; overflow: hidden; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-border); }
.bs-metric-grid[data-variant='compact'] :deep(.bs-metric-card) { --bs-metric-minimum-height: 0; --bs-metric-padding: var(--bs-space-4); --bs-metric-border: 0; --bs-metric-radius: 0; --bs-metric-value-bottom: var(--bs-space-1); --bs-metric-value-size: var(--bs-type-h3-size); --bs-metric-value-line: var(--bs-type-h3-lh); --bs-metric-icon: var(--bs-text-muted); }
@container bs-metrics (min-width: 36rem) { .bs-metric-grid:not([data-columns='1']) .bs-metric-grid__items { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container bs-metrics (min-width: 56rem) { .bs-metric-grid[data-columns='3'] .bs-metric-grid__items { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container bs-metrics (min-width: 68rem) { .bs-metric-grid[data-columns='4'] .bs-metric-grid__items { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
