<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'nav'; gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'; align?: 'stretch' | 'start' | 'center' | 'end'; justify?: 'start' | 'center' | 'end' | 'between'; divider?: boolean }>(), {
  as: 'div', gap: 'md', align: 'stretch', justify: 'start', divider: false,
})
</script>

<template><component :is="as" class="bs-stack" :class="[`bs-stack--gap-${gap}`, `bs-stack--align-${align}`, `bs-stack--justify-${justify}`, { 'bs-stack--divided': divider }]"><slot /></component></template>
