<script setup lang="ts">
withDefaults(defineProps<{ label: string; variant?: 'surface' | 'plain'; sticky?: boolean }>(), { variant: 'surface', sticky: false })
const slots = useSlots()
</script>

<template>
  <div class="ls-toolbar" :class="[{ 'ls-toolbar--surface': variant === 'surface', 'ls-toolbar--sticky': sticky }]" role="toolbar" :aria-label="label">
    <div v-if="slots.default" class="ls-toolbar__main"><slot /></div>
    <div v-if="slots.filters" class="ls-toolbar__filters"><slot name="filters" /></div>
    <div v-if="slots.actions" class="ls-toolbar__actions"><slot name="actions" /></div>
  </div>
</template>
