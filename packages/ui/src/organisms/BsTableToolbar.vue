<script setup lang="ts">
defineProps<{ label: string }>()
const slots = useSlots()
</script>

<template>
  <BsToolbar class="bs-table-toolbar" :label="label" variant="plain">
    <slot />
    <template v-if="slots.filters" #filters><slot name="filters" /></template>
    <template v-if="slots.actions" #actions><slot name="actions" /></template>
  </BsToolbar>
</template>

<style>.bs-table-toolbar { padding: var(--bs-space-3); border-bottom: 1px solid var(--bs-border); }</style>
