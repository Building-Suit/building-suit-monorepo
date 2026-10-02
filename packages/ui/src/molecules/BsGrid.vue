<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section' | 'ul'; columns?: 1 | 2 | 3 | 4 | 'auto'; minItemWidth?: 'sm' | 'md' | 'lg'; gap?: 'none' | 'sm' | 'md' | 'lg'; align?: 'stretch' | 'start' | 'center' | 'end' }>(), {
  as: 'div', columns: 1, minItemWidth: 'md', gap: 'md', align: 'stretch',
})
</script>

<template><component :is="as" class="bs-grid" :class="[`bs-grid--columns-${columns}`, `bs-grid--minimum-${minItemWidth}`, `bs-grid--gap-${gap}`, `bs-grid--align-${align}`]"><slot /></component></template>
