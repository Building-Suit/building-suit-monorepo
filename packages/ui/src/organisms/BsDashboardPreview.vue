<script setup lang="ts">
defineProps<{ label: string; title: string; periodLabel: string; metrics: Array<{ label: string; value: string }> }>()
</script>

<template>
  <div class="ls-hero-preview overflow-hidden rounded-modal border">
    <div class="flex items-center gap-2 border-b border-line px-4 py-3 text-xs text-fg-muted">
      <span class="h-2 w-2 rounded-full bg-brand-gold" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border-strong)]" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border)]" />
      <span class="ms-auto font-semibold">{{ label }}</span>
    </div>
    <div class="grid min-h-[29rem] sm:grid-cols-[8.5rem_1fr]">
      <div class="hidden border-e border-line p-4 sm:block">
        <div class="h-8 w-24 rounded-control bg-[var(--bs-border)]" />
        <div class="mt-8 space-y-3" aria-hidden="true"><span v-for="width in [88, 72, 82, 60, 76]" :key="width" class="block h-2 rounded-full bg-[var(--bs-border)]" :style="{ width: `${width}%` }" /></div>
      </div>
      <div class="min-w-0 p-4 sm:p-5">
        <div class="mb-5 flex items-end justify-between gap-3"><div><p class="text-xs text-fg-muted">{{ label }}</p><p class="mt-1 text-base font-bold">{{ title }}</p></div><span class="text-xs text-fg-muted">{{ periodLabel }}</span></div>
        <div class="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-[var(--bs-border)]">
          <div v-for="metric in metrics" :key="metric.label" class="bg-surface-muted p-3 sm:p-4"><p class="text-xs text-fg-muted">{{ metric.label }}</p><p class="mt-2 text-sm font-bold tabular-nums sm:text-base" dir="ltr">{{ metric.value }}</p></div>
        </div>
        <div class="mt-4 border-t border-line pt-5">
          <div class="flex h-32 items-end gap-2" aria-hidden="true"><div v-for="height in [42, 68, 52, 84, 73, 96]" :key="height" class="flex h-full flex-1 items-end gap-1"><span class="w-1/2 rounded-t-sm bg-brand-gold" :style="{ height: `${height}%` }" /><span class="w-1/2 rounded-t-sm bg-[var(--bs-border-strong)]" :style="{ height: `${Math.max(24, height - 25)}%` }" /></div></div>
          <div class="mt-3 flex justify-between" aria-hidden="true"><span v-for="month in 6" :key="month" class="h-1 w-1 rounded-full bg-[var(--bs-border-strong)]" /></div>
        </div>
      </div>
    </div>
  </div>
</template>
