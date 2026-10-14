<script setup lang="ts">
withDefaults(defineProps<{ columns?: 1 | 2 | 3; density?: 'compact' | 'comfortable'; divided?: boolean }>(), { columns: 1, density: 'comfortable', divided: false })
</script>

<template><dl class="bs-description-list" :class="[`bs-description-list--columns-${columns}`, `bs-description-list--${density}`, { 'bs-description-list--divided': divided }]"><slot /></dl></template>
