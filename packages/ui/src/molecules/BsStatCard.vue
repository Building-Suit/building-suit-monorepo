<script setup lang="ts">
withDefaults(defineProps<{ title: string; changeLabel?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; hint?: string }>(), {
  changeLabel: undefined, tone: 'neutral', hint: undefined,
})
</script>

<template><BsKpiCard :title="title" :change-label="changeLabel" :tone="tone" :hint="hint"><slot /></BsKpiCard></template>
