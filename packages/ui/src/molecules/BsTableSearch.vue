<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{ label: string; placeholder?: string }>()
</script>

<template><BsSearchField v-model="model" class="bs-table-search" :label="label" :placeholder="placeholder || label" /></template>

<style>.bs-table-search { width: min(100%, 24rem); }</style>
