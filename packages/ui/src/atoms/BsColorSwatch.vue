<script setup lang="ts">
const props = defineProps<{ color?: string | null }>()
const color = computed(() => props.color && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(props.color) ? props.color : 'var(--bs-primary)')
</script>

<template><span class="bs-color-swatch" :style="{ backgroundColor: color }" aria-hidden="true" /></template>

<style>
.bs-color-swatch { display: inline-block; width: var(--bs-space-2); height: var(--bs-space-2); flex-shrink: 0; border-radius: 50%; }
</style>
