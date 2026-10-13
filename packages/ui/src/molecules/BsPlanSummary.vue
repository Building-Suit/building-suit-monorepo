<script setup lang="ts">
withDefaults(defineProps<{ name: string; status: string; detail?: string; actionLabel: string; to: string; collapsed?: boolean }>(), { detail: '', collapsed: false })
</script>
<template>
  <NuxtLink :to="to" class="bs-plan-summary block rounded-card border border-line bg-surface-muted p-3" :class="{ 'bs-plan-summary--collapsed': collapsed }" :title="`${name} · ${status}`" :aria-label="`${name} · ${status} · ${actionLabel}`">
    <div class="flex items-center gap-2"><BsIcon name="wallet" :size="20" class="shrink-0 text-accent" /><strong class="bs-plan-summary__copy min-w-0 break-words text-sm">{{ name }}</strong></div>
    <div class="bs-plan-summary__copy"><p class="mt-2 text-xs font-semibold">{{ status }}</p><p v-if="detail" class="mt-1 text-xs text-fg-muted">{{ detail }}</p><span class="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-link">{{ actionLabel }} <span aria-hidden="true" class="ms-2">↗</span></span></div>
  </NuxtLink>
</template>
<style scoped>
@media (min-width: 1024px) { .bs-plan-summary--collapsed { padding: .75rem .25rem; } .bs-plan-summary--collapsed .bs-plan-summary__copy { display: none; } .bs-plan-summary--collapsed > div { justify-content: center; } }
</style>
