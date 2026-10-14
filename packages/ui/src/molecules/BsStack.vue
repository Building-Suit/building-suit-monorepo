<script setup lang="ts">
import type { BsLayoutProps } from '../layout'
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'nav'; gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'; align?: 'stretch' | 'start' | 'center' | 'end'; justify?: 'start' | 'center' | 'end' | 'between'; divider?: boolean } & BsLayoutProps>(), {
  as: 'div', gap: 'md', align: 'stretch', justify: 'start', divider: false,
})
</script>

<template><component :is="as" :data-bs-padding="padding" :data-bs-surface="surface" :data-bs-border="border || undefined" :data-bs-radius="radius" :data-bs-visibility="visibility" :data-bs-grow="grow || undefined" :data-bs-overflow="overflow" :data-bs-span="span" class="bs-stack" :class="[`bs-stack--gap-${gap}`, `bs-stack--align-${align}`, `bs-stack--justify-${justify}`, { 'bs-stack--divided': divider }]"><slot /></component></template>
