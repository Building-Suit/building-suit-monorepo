<script setup lang="ts">
export type BsTextElement = 'p' | 'span' | 'strong' | 'em' | 'small' | 'time' | 'bdi'

withDefaults(defineProps<{
  as?: BsTextElement
  size?: 'xs' | 'sm' | 'md' | 'lg'
  tone?: 'default' | 'muted' | 'disabled' | 'link' | 'success' | 'warning' | 'danger' | 'info'
  emphasis?: 'regular' | 'medium' | 'semibold' | 'bold' | 'strong'
  align?: 'start' | 'center' | 'end'
  wrap?: 'normal' | 'balance' | 'preserve' | 'nowrap'
  truncate?: boolean
  numeric?: boolean
  dir?: 'ltr' | 'rtl' | 'auto'
  datetime?: string
}>(), {
  as: 'p', size: 'md', tone: 'default', emphasis: 'regular', align: 'start',
  wrap: 'normal', truncate: false, numeric: false, dir: undefined, datetime: undefined,
})
</script>

<template>
  <component
    :is="as"
    class="bs-text"
    :class="[`bs-text--size-${size}`, `bs-text--tone-${tone}`, `bs-text--emphasis-${emphasis}`, `bs-text--align-${align}`, `bs-text--wrap-${wrap}`, { 'bs-text--truncate': truncate, 'bs-text--numeric': numeric }]"
    :dir="dir"
    :datetime="as === 'time' ? datetime : undefined"
  ><slot /></component>
</template>
