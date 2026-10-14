<script setup lang="ts">
export type BsBoxElement = 'div' | 'main' | 'section' | 'article' | 'header' | 'footer' | 'nav' | 'aside'

withDefaults(defineProps<{
  as?: BsBoxElement
  role?: string
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  surface?: 'none' | 'default' | 'muted' | 'raised'
  radius?: 'none' | 'control' | 'card' | 'round'
  border?: boolean
  scroll?: 'none' | 'x' | 'y' | 'both'
  visibility?: 'all' | 'mobile' | 'desktop'
  grow?: boolean
  overflow?: 'visible' | 'hidden'
  span?: 1 | 2 | 3 | 4 | 5
  sticky?: 'none' | 'top' | 'bottom'
}>(), {
  as: 'div', role: undefined, padding: 'none', surface: 'none', radius: 'none',
  border: false, scroll: 'none', sticky: 'none', visibility: 'all', grow: false, overflow: 'visible', span: undefined,
})
</script>

<template>
  <component
    :is="as"
    :data-bs-visibility="visibility" :data-bs-grow="grow || undefined" :data-bs-overflow="overflow" :data-bs-span="span"
    class="bs-box"
    :class="[`bs-box--padding-${padding}`, `bs-box--surface-${surface}`, `bs-box--radius-${radius}`, `bs-box--scroll-${scroll}`, `bs-box--sticky-${sticky}`, { 'bs-box--border': border }]"
    :role="role"
  ><slot /></component>
</template>
