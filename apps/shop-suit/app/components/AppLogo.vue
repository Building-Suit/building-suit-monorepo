<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'auto' | 'light' | 'dark' }>(), { tone: 'auto' })
</script>
<template><BsProductLogo name="Shop Suit" monogram="S" :tone="tone" /></template>
