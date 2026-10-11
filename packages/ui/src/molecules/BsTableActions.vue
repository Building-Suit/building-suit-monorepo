<script setup lang="ts">
withDefaults(defineProps<{ align?: 'start' | 'end' }>(), { align: 'end' })
</script>

<template><BsInline class="bs-table-actions" :justify="align" gap="sm" wrap><slot /></BsInline></template>

<style>.bs-table-actions { min-width: max-content; }</style>
