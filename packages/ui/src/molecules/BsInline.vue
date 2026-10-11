<script setup lang="ts">
import type { BsLayoutProps } from '../layout'
withDefaults(defineProps<{ as?: 'div' | 'span' | 'section' | 'header' | 'footer' | 'nav'; gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'; align?: 'stretch' | 'start' | 'center' | 'end' | 'baseline'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean; collapse?: 'never' | 'sm' | 'md' } & BsLayoutProps>(), {
  as: 'div', gap: 'sm', align: 'center', justify: 'start', wrap: true, collapse: 'never',
})
</script>

<template><component :is="as" :data-bs-padding="padding" :data-bs-surface="surface" :data-bs-border="border || undefined" :data-bs-radius="radius" :data-bs-visibility="visibility" :data-bs-grow="grow || undefined" :data-bs-overflow="overflow" :data-bs-span="span" class="bs-inline" :class="[`bs-inline--gap-${gap}`, `bs-inline--align-${align}`, `bs-inline--justify-${justify}`, `bs-inline--collapse-${collapse}`, { 'bs-inline--wrap': wrap }]"><slot /></component></template>
