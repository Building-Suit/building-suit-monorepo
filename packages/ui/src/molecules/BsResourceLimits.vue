<script setup lang="ts">
defineProps<{ items: Array<{ key: string; label: string; value: string; description?: string }> }>()
</script>
<template><dl class="bs-resource-limits"><div v-for="item in items" :key="item.key" class="bs-resource-limits__item"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd><p v-if="item.description">{{ item.description }}</p></div></dl></template>
<style>
.bs-resource-limits { display: grid; margin-top: var(--bs-space-5); gap: var(--bs-space-2); }
.bs-resource-limits__item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--bs-space-1) var(--bs-space-3); padding-block: var(--bs-space-2); border-block-end: 1px solid var(--bs-border); font-size: var(--bs-type-body-m-size); }
.bs-resource-limits__item dt { color: var(--bs-text-muted); }.bs-resource-limits__item dd { font-weight: var(--bs-weight-bold); }.bs-resource-limits__item p { grid-column: 1 / -1; color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); }
</style>
