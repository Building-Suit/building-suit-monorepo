<script setup lang="ts">
withDefaults(defineProps<{ as?: 'section' | 'aside' | 'div'; tone?: 'default' | 'muted' | 'info'; padding?: 'sm' | 'md' | 'lg'; labelledby?: string }>(), {
  as: 'section', tone: 'default', padding: 'md', labelledby: undefined,
})
</script>

<template><component :is="as" class="ls-card bs-panel" :class="[`bs-panel--${tone}`, `bs-panel--padding-${padding}`]" :aria-labelledby="labelledby"><slot /></component></template>

<style scoped>
.bs-panel { min-inline-size: 0; box-shadow: none; }
.bs-panel--default { background: var(--bs-component-dashboard-chart-surface); }
.bs-panel :deep(h2), .bs-panel :deep(h3) { font-weight: var(--bs-weight-semibold); }
</style>
