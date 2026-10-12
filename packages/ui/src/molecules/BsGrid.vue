<script setup lang="ts">
import type { BsLayoutProps } from '../layout'
withDefaults(defineProps<{ as?: 'div' | 'section' | 'ul'; columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'auto'; minItemWidth?: 'sm' | 'md' | 'lg'; gap?: 'none' | 'sm' | 'md' | 'lg'; align?: 'stretch' | 'start' | 'center' | 'end' } & BsLayoutProps>(), {
  as: 'div', columns: 1, minItemWidth: 'md', gap: 'md', align: 'stretch',
})
</script>

<template><component :is="as" :data-bs-padding="padding" :data-bs-surface="surface" :data-bs-border="border || undefined" :data-bs-radius="radius" :data-bs-visibility="visibility" :data-bs-grow="grow || undefined" :data-bs-overflow="overflow" :data-bs-span="span" class="bs-grid" :class="[`bs-grid--columns-${columns}`, `bs-grid--minimum-${minItemWidth}`, `bs-grid--gap-${gap}`, `bs-grid--align-${align}`]"><slot /></component></template>
