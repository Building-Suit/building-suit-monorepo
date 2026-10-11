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
  sticky?: 'none' | 'top' | 'bottom'
}>(), {
  as: 'div', role: undefined, padding: 'none', surface: 'none', radius: 'none',
  border: false, scroll: 'none', sticky: 'none',
})
</script>

<template>
  <component
    :is="as"
    class="bs-box"
    :class="[`bs-box--padding-${padding}`, `bs-box--surface-${surface}`, `bs-box--radius-${radius}`, `bs-box--scroll-${scroll}`, `bs-box--sticky-${sticky}`, { 'bs-box--border': border }]"
    :role="role"
  ><slot /></component>
</template>
