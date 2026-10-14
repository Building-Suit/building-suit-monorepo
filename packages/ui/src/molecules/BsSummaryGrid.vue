<script setup lang="ts">
withDefaults(defineProps<{ columns?: 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' }>(), { columns: 4, gap: 'md' })
</script>

<template><BsGrid class="bs-summary-grid" :columns="columns" :gap="gap"><slot /></BsGrid></template>
