<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'span' | 'section' | 'header' | 'footer' | 'nav'; gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'; align?: 'stretch' | 'start' | 'center' | 'end' | 'baseline'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean; collapse?: 'never' | 'sm' | 'md' }>(), {
  as: 'div', gap: 'sm', align: 'center', justify: 'start', wrap: true, collapse: 'never',
})
</script>

<template><component :is="as" class="bs-inline" :class="[`bs-inline--gap-${gap}`, `bs-inline--align-${align}`, `bs-inline--justify-${justify}`, `bs-inline--collapse-${collapse}`, { 'bs-inline--wrap': wrap }]"><slot /></component></template>
