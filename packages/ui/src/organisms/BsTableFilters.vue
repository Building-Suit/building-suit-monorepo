<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template><BsBox class="bs-table-filters" role="group" :aria-label="label"><slot /></BsBox></template>

<style>.bs-table-filters { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: end; gap: var(--bs-space-3); }</style>
