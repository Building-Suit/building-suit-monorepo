<script setup lang="ts">
const props = withDefaults(defineProps<{
  level?: 1 | 2 | 3 | 4 | 5 | 6
  size?: 'display' | 'h1' | 'h2' | 'h3' | 'body'
  align?: 'start' | 'center' | 'end'
  tone?: 'default' | 'muted'
  id?: string
}>(), { level: 2, size: undefined, align: 'start', tone: 'default', id: undefined })

const element = computed(() => `h${props.level}`)
const visualSize = computed(() => props.size ?? (props.level === 1 ? 'h1' : props.level === 2 ? 'h2' : 'h3'))
</script>

<template>
  <component :is="element" :id="id" class="bs-heading" :class="[`bs-heading--${visualSize}`, `bs-heading--${align}`, `bs-heading--${tone}`]"><slot /></component>
</template>
