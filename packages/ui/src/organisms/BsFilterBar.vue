<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  variant?: 'surface' | 'plain'
  sticky?: boolean
}>(), {
  variant: 'surface',
  sticky: false,
})

defineSlots<{
  search(): unknown
  filters(): unknown
  actions(): unknown
  default(): unknown
}>()
</script>

<template>
  <BsToolbar :label="label" :variant="variant" :sticky="sticky" data-form-role="filter">
    <slot name="search"><slot /></slot>
    <template v-if="$slots.filters" #filters><slot name="filters" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </BsToolbar>
</template>
