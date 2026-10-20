<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  variant?: 'surface' | 'plain'
  sticky?: boolean
}>(), {
  variant: 'plain',
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
  <BsToolbar :label="label" :variant="variant" :sticky="sticky" data-form-role="filter" class="bs-filter-bar">
    <slot name="search"><slot /></slot>
    <template v-if="$slots.filters" #filters><slot name="filters" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </BsToolbar>
</template>

<style scoped>
.bs-filter-bar { min-inline-size: 0; }
.bs-filter-bar :deep(.ls-field) { gap: var(--bs-space-2); }
.bs-filter-bar :deep(.ls-field__label), .bs-filter-bar :deep(.bs-field-group__legend) { font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); font-weight: var(--bs-weight-medium); }
.bs-filter-bar :deep(.bs-grid) { gap: var(--bs-space-4); }
</style>
