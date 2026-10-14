<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string; items: Array<{ id: string; label: string; hint: string; value: number; formatted: string }>
  emptyLabel: string; kind?: 'bars' | 'donut'; action?: { label: string; to: string }
}>(), { kind: 'bars', action: undefined })
const values = computed(() => props.items.map(item => Number.isFinite(item.value) ? item.value : 0))
const total = computed(() => values.value.reduce((sum, value) => sum + Math.max(0, value), 0))
const showDonut = computed(() => props.kind === 'donut' && total.value > 0 && values.value.every(value => value >= 0))
const maximum = computed(() => Math.max(1, ...values.value.map(value => Math.abs(value))))
const colors = ['var(--bs-mix-primary)', 'var(--bs-mix-secondary)', 'var(--bs-text-muted)', 'var(--bs-border-strong)']
const donut = computed(() => {
  if (!total.value) return ''
  let offset = 0
  return `conic-gradient(${values.value.map((value, index) => {
    const start = offset; offset += Math.max(0, value) / total.value * 100
    return `${colors[index % colors.length]} ${start}% ${offset}%`
  }).join(',')})`
})
</script>
<template>
  <BsCard as="section" padding="lg" class="bs-mix-chart" :aria-label="title">
    <BsInline justify="between"><BsHeading :level="2">{{ title }}</BsHeading><BsLink v-if="action" :to="action.to">{{ action.label }}</BsLink></BsInline>
    <p v-if="!items.length" class="py-12 text-center text-sm text-fg-muted">{{ emptyLabel }}</p>
    <div v-else class="mt-6 grid items-center gap-6" :class="showDonut ? 'sm:grid-cols-[minmax(8rem,1fr)_2fr]' : ''">
      <div v-if="showDonut" aria-hidden="true" class="bs-mix-chart__donut" :style="{ background: donut }"><div /></div>
      <ul class="space-y-5"><li v-for="(item, index) in items" :key="item.id">
        <div class="flex min-w-0 flex-wrap justify-between gap-2 text-sm"><span class="flex min-w-0 items-center gap-2"><span aria-hidden="true" class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: colors[index % colors.length] }" /><span class="break-words">{{ item.label }}</span></span><strong class="tabular-nums">{{ item.formatted }}</strong></div>
        <p v-if="item.hint" class="mt-1 text-xs text-fg-muted">{{ item.hint }}</p>
        <div v-if="!showDonut" class="mt-2 h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div class="bs-mix-chart__bar h-full rounded-full" :data-negative="item.value < 0 || undefined" :style="{ width: `${Math.abs(values[index] ?? 0) / maximum * 100}%`, backgroundColor: colors[index % colors.length] }" /></div>
      </li></ul>
    </div>
  </BsCard>
</template>
<style scoped>
.bs-mix-chart { min-inline-size: 0; --bs-mix-primary: var(--bs-color-brand-building-navy); --bs-mix-secondary: var(--bs-color-brand-premium-gold); }
:global([data-theme='dark']) .bs-mix-chart { --bs-mix-primary: var(--bs-color-brand-premium-gold); --bs-mix-secondary: var(--bs-text-muted); }
.bs-mix-chart__donut { aspect-ratio: 1; border-radius: 50%; padding: 22%; inline-size: 100%; max-inline-size: 13rem; margin-inline: auto; }
.bs-mix-chart__donut > div { inline-size: 100%; block-size: 100%; border-radius: 50%; background: var(--bs-surface); }
.bs-mix-chart__bar[data-negative] { background-image: repeating-linear-gradient(135deg, transparent 0 3px, var(--bs-surface) 3px 4px); }
</style>
